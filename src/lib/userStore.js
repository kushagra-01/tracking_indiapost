/**
 * App users in MongoDB (default superadmin is seeded on server start).
 */
const { AppError } = require("./errors");
const { hashPassword, verifyPassword, newId } = require("./auth");
const mongo = require("./mongo");

async function col() {
  if (!process.env.MONGODB_URI) {
    throw new AppError(
      "MONGODB_REQUIRED",
      "MONGODB_URI is required for user management",
      503
    );
  }
  await mongo.connect();
  return mongo.getUsersCollection();
}

function toPublicUser(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    username: doc.username,
    role: doc.role || "user",
    active: doc.active !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || doc.createdAt
  };
}

async function listUsers() {
  const users = await col();
  const docs = await users.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(toPublicUser);
}

async function findUserById(id) {
  const users = await col();
  const doc = await users.findOne({ id: String(id) });
  return doc || null;
}

async function findUserByUsername(username) {
  const users = await col();
  const doc = await users.findOne({ usernameLower: String(username).trim().toLowerCase() });
  return doc || null;
}

async function createUser({ username, password, role }) {
  const uname = String(username || "").trim();
  if (!uname) throw new AppError("VALIDATION_ERROR", "Username is required", 400);

  const exists = await findUserByUsername(uname);
  if (exists) throw new AppError("CONFLICT", "Username already exists", 409);

  const now = new Date().toISOString();
  const user = {
    id: newId(),
    username: uname,
    usernameLower: uname.toLowerCase(),
    role: role || "user",
    passwordHash: await hashPassword(password),
    active: true,
    createdAt: now,
    updatedAt: now
  };

  const users = await col();
  await users.insertOne(user);
  return toPublicUser(user);
}

async function deleteUser(id) {
  const users = await col();
  const res = await users.deleteOne({ id: String(id) });
  if (res.deletedCount === 0) throw new AppError("NOT_FOUND", "User not found", 404);
}

async function resetUserPassword(id, newPassword) {
  const users = await col();
  const res = await users.updateOne(
    { id: String(id) },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        updatedAt: new Date().toISOString()
      }
    }
  );
  if (res.matchedCount === 0) throw new AppError("NOT_FOUND", "User not found", 404);
}

async function setUserActive(id, active) {
  const users = await col();
  const res = await users.updateOne(
    { id: String(id) },
    { $set: { active: Boolean(active), updatedAt: new Date().toISOString() } }
  );
  if (res.matchedCount === 0) throw new AppError("NOT_FOUND", "User not found", 404);
  const doc = await users.findOne({ id: String(id) });
  return toPublicUser(doc);
}

async function updateOwnPassword(userId, currentPassword, newPassword) {
  const doc = await findUserById(userId);
  if (!doc) throw new AppError("NOT_FOUND", "User not found", 404);
  if (doc.active === false) {
    throw new AppError("FORBIDDEN", "Account is inactive", 403);
  }

  const ok = await verifyPassword(currentPassword, doc.passwordHash);
  if (!ok) throw new AppError("UNAUTHORIZED", "Current password is incorrect", 401);

  const users = await col();
  await users.updateOne(
    { id: String(userId) },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        updatedAt: new Date().toISOString()
      }
    }
  );
}

async function verifyUserCredentials(username, password) {
  const u = await findUserByUsername(username);
  if (!u) return null;
  if (u.active === false) return null;
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok) return null;
  return toPublicUser(u);
}

async function getUserProfile(userId) {
  const doc = await findUserById(userId);
  if (!doc) throw new AppError("NOT_FOUND", "User not found", 404);
  return toPublicUser(doc);
}

/** Ensure default superadmin exists in MongoDB (username/password from env or superadmin/superadmin). */
async function ensureDefaultSuperAdmin() {
  if (!process.env.MONGODB_URI) {
    return null;
  }

  const username = String(
    process.env.SUPERADMIN_USERNAME || "superadmin",
  ).trim();
  const password = String(
    process.env.SUPERADMIN_PASSWORD || "superadmin",
  ).trim();

  const existing = await findUserByUsername(username);
  const now = new Date().toISOString();

  if (existing) {
    const users = await col();
    const patch = { role: "superadmin", active: true, updatedAt: now };
    const passwordOk = await verifyPassword(password, existing.passwordHash);
    if (!passwordOk) {
      patch.passwordHash = await hashPassword(password);
    }
    if (
      existing.role !== "superadmin" ||
      existing.active === false ||
      !passwordOk
    ) {
      await users.updateOne({ id: existing.id }, { $set: patch });
    }
    return toPublicUser(await findUserById(existing.id));
  }

  return createUser({ username, password, role: "superadmin" });
}

module.exports = {
  listUsers,
  createUser,
  deleteUser,
  resetUserPassword,
  setUserActive,
  updateOwnPassword,
  verifyUserCredentials,
  getUserProfile,
  findUserById,
  ensureDefaultSuperAdmin,
  toPublicUser
};
