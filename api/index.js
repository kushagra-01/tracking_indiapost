/**
 * Vercel serverless entry — wraps the Express app and strips the /api prefix
 * (same behavior as the Vite dev proxy in client/vite.config.ts).
 */
require("dotenv").config();

const express = require("express");
const { createApp } = require("../src/server/start");
const mongo = require("../src/lib/mongo");
const { logIndiaPostEnvStatus } = require("../src/lib/envCheck");

logIndiaPostEnvStatus("vercel-cold-start");

const api = createApp();
const app = express();

app.use((req, res, next) => {
  const raw = req.originalUrl || req.url || "";
  const q = raw.indexOf("?");
  const pathOnly = q === -1 ? raw : raw.slice(0, q);
  const qs = q === -1 ? "" : raw.slice(q);

  if (pathOnly.startsWith("/api/")) {
    req.url = (pathOnly.slice(4) || "/") + qs;
  } else if (pathOnly === "/api") {
    req.url = "/" + qs.replace(/^\?/, "?");
  }
  next();
});

let mongoInit = null;
app.use((req, res, next) => {
  if (!mongoInit) {
    mongoInit = mongo.connect().catch(() => {});
  }
  mongoInit.then(() => next(), next);
});

app.use(api);

module.exports = app;
