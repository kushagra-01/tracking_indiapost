const { AppError } = require("../lib/errors");
const { verifyToken } = require("../lib/auth");
const { findUserById } = require("../lib/userStore");

function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const parts = String(hdr).split(" ");
  const token = parts.length === 2 && parts[0].toLowerCase() === "bearer" ? parts[1] : "";

  if (!token) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return next(err);
  }

  req.auth = payload;

  if (payload.role === "superadmin" && payload.sub === "superadmin") {
    return next();
  }

  findUserById(payload.sub)
    .then((doc) => {
      if (!doc || doc.active === false) {
        return next(new AppError("FORBIDDEN", "Account is inactive or not found", 403));
      }
      return next();
    })
    .catch(next);
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

/** SuperAdmin or Admin — for app settings and similar. */
function requireAdminAccess(req, res, next) {
  try {
    const role = req.auth?.role;
    if (role === "superadmin" || role === "admin") {
      return next();
    }
    throw new AppError("FORBIDDEN", "Insufficient permissions", 403);
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth, requireRole, requireAdminAccess };
