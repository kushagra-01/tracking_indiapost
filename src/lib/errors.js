const { indiaPostCredentialStatus } = require("./envCheck");

class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   * @param {Record<string, any>=} details
   */
  constructor(code, message, status, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Turn axios / TCP failures into a client-visible 502 instead of INTERNAL_ERROR. */
function rethrowUpstream(err) {
  if (err && err.name === "AppError") throw err;

  const code = err && err.code;
  const networkCodes = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNABORTED",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH"
  ]);

  if ((err && err.isAxiosError && !err.response) || (code && networkCodes.has(code))) {
    throw new AppError(
      "INDIAPOST_NETWORK_ERROR",
      "Could not reach India Post API. Set INDIAPOST_USERNAME / INDIAPOST_PASSWORD on Vercel and confirm app.indiapost.gov.in is reachable.",
      502,
      { code: code || null, message: err && err.message ? err.message : undefined }
    );
  }

  throw err;
}

module.exports = { AppError, rethrowUpstream };

