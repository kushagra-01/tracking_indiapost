type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

function detailLine(details: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const stage = details.stage;
  if (typeof stage === "string" && stage) lines.push(`Failed at: ${stage.replace(/_/g, " ")}`);

  const deploy = details.deploy_host;
  if (typeof deploy === "string" && deploy) lines.push(`API host: ${deploy}`);

  const upstream = details.upstream_url;
  if (typeof upstream === "string" && upstream) lines.push(`India Post URL: ${upstream}`);

  const net = details.code;
  if (typeof net === "string" && net) lines.push(`Network: ${net}`);

  const creds = details.credentials;
  if (creds && typeof creds === "object") {
    const c = creds as Record<string, string>;
    lines.push(
      `Env: INDIAPOST_USERNAME=${c.INDIAPOST_USERNAME ?? "?"}, INDIAPOST_PASSWORD=${c.INDIAPOST_PASSWORD ?? "?"}`
    );
  }

  return lines;
}

/** Human-readable message from axios API errors (includes code + diagnostic details). */
export function formatApiError(e: unknown, fallback = "Request failed"): string {
  const ax = e as {
    response?: { data?: { error?: ApiErrorPayload } };
    message?: string;
  };
  const err = ax?.response?.data?.error;
  if (!err) return ax?.message || fallback;

  const parts: string[] = [];
  if (err.message) parts.push(err.message);
  if (err.code) parts.push(`[${err.code}]`);

  if (err.details && typeof err.details === "object") {
    parts.push(...detailLine(err.details));
  }

  return parts.filter(Boolean).join("\n") || fallback;
}
