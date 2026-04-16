const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { AppError } = require("./errors");

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function signToken(payload) {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

function verifyToken(token) {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch (err) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

async function hashPassword(password) {
  const pwd = typeof password === "string" ? password : "";
  if (pwd.length < 6) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 6 characters", 400);
  }
  return bcrypt.hash(pwd, 10);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(String(password || ""), String(passwordHash || ""));
}

function newId() {
  return crypto.randomUUID();
}

module.exports = { signToken, verifyToken, hashPassword, verifyPassword, newId };

