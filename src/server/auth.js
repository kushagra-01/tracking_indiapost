const { AppError } = require("../lib/errors");
const { verifyToken } = require("../lib/auth");

function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const parts = String(hdr).split(" ");
    const token = parts.length === 2 && parts[0].toLowerCase() === "bearer" ? parts[1] : "";
    if (!token) throw new AppError("UNAUTHORIZED", "Missing bearer token", 401);
    const payload = verifyToken(token);
    req.auth = payload;
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    try {
      if (!req.auth || req.auth.role !== role) {
        throw new AppError("FORBIDDEN", "Insufficient permissions", 403);
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireAuth, requireRole };

