const axios = require("axios");
const config = require("./config");
const { AppError, rethrowUpstream } = require("./errors");
const { extractEventRemarks } = require("./eventRemarks");
const { sortTrackingEventsDesc } = require("./eventSort");

const LOGIN_PATH = "/beextcustomer/v1/access/login";
const REFRESH_PATH = "/beextcustomer/v1/access/TokenWithRtoken";
const BULK_TRACKING_PATH = "/beextcustomer/v1/tracking/bulk";
/** India Post bulk endpoint accepts at most this many articles per HTTP call; larger lists are split automatically. */
const BULK_MAX_PER_REQUEST = 50;

/**
 * Minimal in-memory token cache.
 * Note: suitable for a single-node deployment; for multi-node, persist tokens or use a shared cache.
 */
const tokenState = {
  accessToken: process.env.INDIAPOST_ACCESS_TOKEN || "",
  refreshToken: process.env.INDIAPOST_REFRESH_TOKEN || "",
  accessTokenExpiresAtMs: 0
};

function nowMs() {
  return Date.now();
}

function computeExpiry(expiresInSeconds) {
  const skewMs = 30_000; // avoid edge-of-expiry failures
  const ttlMs = Math.max(0, Number(expiresInSeconds || 0) * 1000 - skewMs);
  return nowMs() + ttlMs;
}

function createHttp(baseURL) {
  return axios.create({
    baseURL,
    timeout: config.indiapostHttpTimeoutMs,
    validateStatus: () => true
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fewer upstream calls when clients send duplicates; preserves first-seen order. */
function dedupeConsignmentsPreserveOrder(consignments) {
  const seen = new Set();
  const out = [];
  for (const c of consignments) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

async function login(http) {
  // if (!envStatusLogged) {
  //   logIndiaPostEnvStatus("before-indiapost-login");
  //   envStatusLogged = true;
  // }

  const usernameRaw = process.env.INDIAPOST_USERNAME;
  const passwordRaw = process.env.INDIAPOST_PASSWORD;
  const username = typeof usernameRaw === "string" ? usernameRaw.trim() : usernameRaw;
  const password = typeof passwordRaw === "string" ? passwordRaw.trim() : passwordRaw;

  if (!username || !password) {
    throw new AppError(
      "CONFIG_MISSING",
      "Missing INDIAPOST_USERNAME / INDIAPOST_PASSWORD in environment",
      500,
      {
        stage: "indiapost_login",
        INDIAPOST_USERNAME: username ? "set" : "missing",
        INDIAPOST_PASSWORD: password ? "set" : "missing"
      }
    );
  }

  let resp;
  try {
    resp = await http.post(
      LOGIN_PATH,
      { username, password },
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    rethrowUpstream(err);
  }

  if (resp.status !== 200 || !resp.data || resp.data.success !== true) {
    const upstreamMsg =
      resp &&
      resp.data &&
      resp.data.error &&
      typeof resp.data.error.message === "string"
        ? resp.data.error.message
        : "";

    if (resp.status === 400 && upstreamMsg.toLowerCase().includes("invalid user credentials")) {
      throw new AppError(
        "INDIAPOST_INVALID_CREDENTIALS",
        "Invalid India Post credentials (check INDIAPOST_USERNAME / INDIAPOST_PASSWORD)",
        401,
        { stage: "indiapost_login", status: resp.status, body: resp.data }
      );
    }

    throw new AppError(
      "INDIAPOST_LOGIN_FAILED",
      "India Post login failed",
      502,
      { stage: "indiapost_login", status: resp.status, body: resp.data }
    );
  }

  const data = resp.data.data || {};
  tokenState.accessToken = data.access_token || "";
  tokenState.refreshToken = data.refresh_token || "";
  tokenState.accessTokenExpiresAtMs = computeExpiry(data.expires_in);

  if (!tokenState.accessToken) {
    throw new AppError(
      "INDIAPOST_LOGIN_BAD_RESPONSE",
      "India Post login succeeded but no access token returned",
      502,
      { body: resp.data }
    );
  }
}

async function refresh(http) {
  if (!tokenState.refreshToken) return false;

  let resp;
  try {
    resp = await http.post(
      REFRESH_PATH,
      {},
      { headers: { authorization: `Bearer ${tokenState.refreshToken}` } }
    );
  } catch (err) {
    rethrowUpstream(err);
  }

  if (resp.status !== 200 || !resp.data || resp.data.success !== true) {
    return false;
  }

  const data = resp.data.data || {};
  tokenState.accessToken = data.access_token || tokenState.accessToken;
  tokenState.refreshToken = data.refresh_token || tokenState.refreshToken;
  tokenState.accessTokenExpiresAtMs = computeExpiry(data.expires_in);

  return Boolean(tokenState.accessToken);
}

async function ensureAccessToken(http) {
  if (tokenState.accessToken && tokenState.accessTokenExpiresAtMs > nowMs()) return;

  const refreshed = await refresh(http);
  if (refreshed) return;

  await login(http);
}

async function bulkTrackOnce(http, consignments) {
  let resp;
  try {
    resp = await http.post(
      BULK_TRACKING_PATH,
      { bulk: consignments },
      {
        headers: {
          authorization: `Bearer ${tokenState.accessToken}`,
          "content-type": "application/json"
        }
      }
    );
  } catch (err) {
    rethrowUpstream(err);
  }

  if (resp.status === 401 || resp.status === 403) {
    tokenState.accessTokenExpiresAtMs = 0;
    await ensureAccessToken(http);
    let retry;
    try {
      retry = await http.post(
        BULK_TRACKING_PATH,
        { bulk: consignments },
        {
          headers: {
            authorization: `Bearer ${tokenState.accessToken}`,
            "content-type": "application/json"
          }
        }
      );
    } catch (err) {
      rethrowUpstream(err);
    }
    return normalizeBulkTrackingResponse(retry);
  }

  return normalizeBulkTrackingResponse(resp);
}

async function bulkTrack(consignments) {
  try {
    return await bulkTrackInner(consignments);
  } catch (err) {
    rethrowUpstream(err);
  }
}

async function bulkTrackInner(consignments) {
  const baseURL = process.env.INDIAPOST_BASE_URL || "https://app.indiapost.gov.in";
  const http = createHttp(baseURL);

  await ensureAccessToken(http);

  const unique = dedupeConsignmentsPreserveOrder(consignments);
  if (!unique.length) {
    return { upstream_message: "", count: 0, items: [] };
  }

  const chunks = [];
  for (let i = 0; i < unique.length; i += BULK_MAX_PER_REQUEST) {
    chunks.push(unique.slice(i, i + BULK_MAX_PER_REQUEST));
  }

  const mergedItems = [];
  const messages = [];
  const conc = config.indiapostChunkConcurrency;
  const delayMs = config.indiapostChunkDelayMs;
  const logChunks = process.env.INDIAPOST_LOG_CHUNKS === "1";
  const totalWaves = Math.ceil(chunks.length / conc);

  for (let i = 0; i < chunks.length; i += conc) {
    const waveChunks = chunks.slice(i, i + conc);
    if (logChunks) {
      const waveNum = Math.floor(i / conc) + 1;
      // eslint-disable-next-line no-console
      console.error(`[indiapost] bulk wave ${waveNum}/${totalWaves} (${waveChunks.length} parallel request(s), ≤${BULK_MAX_PER_REQUEST} articles each)`);
    }

    const parts = await Promise.all(waveChunks.map((chunk) => bulkTrackOnce(http, chunk)));
    for (const part of parts) {
      mergedItems.push(...part.items);
      if (part.upstream_message) messages.push(part.upstream_message);
    }

    if (delayMs > 0 && i + conc < chunks.length) {
      await sleep(delayMs);
    }
  }

  return {
    upstream_message: messages.join(" ").trim(),
    count: mergedItems.length,
    items: mergedItems
  };
}

function normalizeBulkTrackingResponse(resp) {
  if (resp.status !== 200) {
    throw new AppError(
      "INDIAPOST_UPSTREAM_ERROR",
      "India Post tracking request failed",
      502,
      { stage: "indiapost_bulk_tracking", status: resp.status, body: resp.data }
    );
  }

  // Expected upstream shape (per doc):
  // { status_code: 200, success: true, message: "...", data: [...] }
  const body = resp.data || {};
  if (body.success !== true || !Array.isArray(body.data)) {
    throw new AppError(
      "INDIAPOST_BAD_RESPONSE",
      "India Post tracking response was not in expected format",
      502,
      { stage: "indiapost_bulk_tracking", body }
    );
  }

  const items = body.data.map((row) => {
    const booking = row.booking_details || {};
    const rawEvents = Array.isArray(row.tracking_details) ? row.tracking_details : [];
    const del = row.del_status || {};

    const tracking_details = sortTrackingEventsDesc(
      rawEvents.map((e) => ({
        date: e.date || null,
        time: e.time || null,
        office: e.office || null,
        officeid: e.officeid ?? null,
        event: e.event || null,
        remarks: extractEventRemarks(e)
      }))
    );

    const lastEvent = tracking_details.length ? tracking_details[0] : null;

    return {
      consignment: booking.article_number || null,
      status: del.del_status || null,
      last_event: lastEvent
        ? {
            date: lastEvent.date || null,
            time: lastEvent.time || null,
            office: lastEvent.office || null,
            event: lastEvent.event || null
          }
        : null,
      booking_details: {
        article_number: booking.article_number || null,
        /** If API sends MO / consignment separately from article — shown on reports when present */
        mo_number: booking.mo_number || booking.mo_no || booking.consignment_mo || null,
        article_type: booking.article_type || null,
        booked_at: booking.booked_at || null,
        booked_on: booking.booked_on || null,
        origin_pincode: booking.origin_pincode || null,
        destination_pincode: booking.destination_pincode || null,
        delivery_location: booking.delivery_location || null,
        delivery_confirmed_on: booking.delivery_confirmed_on || null,
        tariff: booking.tariff ?? null
      },
      tracking_details
    };
  });

  return {
    upstream_message: body.message || "",
    count: items.length,
    items
  };
}

module.exports = { bulkTrack };

