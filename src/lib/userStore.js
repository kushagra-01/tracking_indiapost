const fs = require("fs/promises");
const path = require("path");

const { AppError } = require("./errors");
const { hashPassword, verifyPassword, newId } = require("./auth");

function storePath() {
  return process.env.USER_STORE_PATH || path.join(__dirname, "..", "data", "users.json");
}

async function ensureDir() {
  const p = storePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users)) {
      return { users: [] };
    }
    return { users: parsed.users };
  } catch (err) {
    if (err && err.code === "ENOENT") return { users: [] };
    throw new AppError("USER_STORE_ERROR", "Failed to read user store", 500);
  }
}

async function writeStore(next) {
  await ensureDir();
  try {
    await fs.writeFile(storePath(), JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    throw new AppError("USER_STORE_ERROR", "Failed to write user store", 500);
  }
}

async function listUsers() {
  const st = await readStore();
  return st.users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt
  }));
}

async function findUserByUsername(username) {
  const st = await readStore();
  const u = st.users.find((x) => String(x.username).toLowerCase() === String(username).toLowerCase());
  return u || null;
}

async function createUser({ username, password, role }) {
  const uname = String(username || "").trim();
  if (!uname) throw new AppError("VALIDATION_ERROR", "Username is required", 400);

  const st = await readStore();
  const exists = st.users.some((u) => String(u.username).toLowerCase() === uname.toLowerCase());
  if (exists) throw new AppError("CONFLICT", "Username already exists", 409);

  const passwordHash = await hashPassword(password);

  const user = {
    id: newId(),
    username: uname,
    role: role || "user",
    passwordHash,
    createdAt: new Date().toISOString()
  };

  st.users.push(user);
  await writeStore(st);
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

async function deleteUser(id) {
  const st = await readStore();
  const before = st.users.length;
  st.users = st.users.filter((u) => u.id !== id);
  if (st.users.length === before) throw new AppError("NOT_FOUND", "User not found", 404);
  await writeStore(st);
}

async function resetUserPassword(id, newPassword) {
  const st = await readStore();
  const idx = st.users.findIndex((u) => u.id === id);
  if (idx === -1) throw new AppError("NOT_FOUND", "User not found", 404);
  st.users[idx].passwordHash = await hashPassword(newPassword);
  await writeStore(st);
}

async function verifyUserCredentials(username, password) {
  const u = await findUserByUsername(username);
  if (!u) return null;
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok) return null;
  return { id: u.id, username: u.username, role: u.role };
}

module.exports = {
  listUsers,
  createUser,
  deleteUser,
  resetUserPassword,
  verifyUserCredentials
};

