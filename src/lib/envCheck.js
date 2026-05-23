/**
 * Safe console diagnostics for India Post env vars (never logs secrets).
 */

function maskUsername(username) {
  const u = typeof username === "string" ? username.trim() : "";
  if (!u) return "(not set)";
  if (u.length <= 4) return `**** (${u.length} chars)`;
  return `${u.slice(0, 2)}***${u.slice(-2)} (${u.length} chars)`;
}

function indiaPostCredentialStatus() {
  const usernameRaw = process.env.INDIAPOST_USERNAME;
  const passwordRaw = process.env.INDIAPOST_PASSWORD;
  const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw.trim() : "";

  return {
    usernameSet: Boolean(username),
    passwordSet: Boolean(password),
    usernameMasked: maskUsername(usernameRaw),
    passwordHint: password ? `(set, ${password.length} chars)` : "(not set)",
    baseUrl: process.env.INDIAPOST_BASE_URL || "https://app.indiapost.gov.in"
  };
}

/**
 * @param {string} [context]
 */
function logIndiaPostEnvStatus(context = "startup") {
  const s = indiaPostCredentialStatus();
  // eslint-disable-next-line no-console
  console.log(`[indiapost-env] ${context}`, {
    INDIAPOST_USERNAME: s.usernameMasked,
    INDIAPOST_PASSWORD: s.passwordHint,
    INDIAPOST_BASE_URL: s.baseUrl,
    host: process.env.VERCEL ? "vercel" : "node",
    vercelEnv: process.env.VERCEL_ENV || null
  });
  if (!s.usernameSet || !s.passwordSet) {
    // eslint-disable-next-line no-console
    console.warn(
      "[indiapost-env] Missing credentials — set INDIAPOST_USERNAME and INDIAPOST_PASSWORD in Vercel → Settings → Environment Variables (Production)."
    );
  }
  return s;
}

module.exports = { logIndiaPostEnvStatus, indiaPostCredentialStatus, maskUsername };
