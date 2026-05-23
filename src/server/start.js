require("dotenv").config();

const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const { AppError } = require("../lib/errors");
const { ok, fail } = require("../lib/respond");
const { signToken } = require("../lib/auth");
const { trackRequestSchema } = require("../schemas/track");
const { trackReportRequestSchema } = require("../schemas/trackReport");
const { loginSchema } = require("../schemas/auth");
const { createUserSchema, resetPasswordSchema } = require("../schemas/users");
const {
  verifyUserCredentials,
  listUsers,
  createUser,
  deleteUser,
  resetUserPassword,
} = require("../lib/userStore");
const config = require("../lib/config");
const { bulkTrack } = require("../lib/indiaPostClient");
const {
  createDownloadMeta,
  buildReportBuffer,
  buildUploadTemplateBuffer,
} = require("../lib/report");
const { UPLOAD_TEMPLATE_FILENAME } = require("../lib/reportFormats");
const { requireAuth, requireRole } = require("./auth");
const fullExportJob = require("../lib/fullExportJob");
const exportShare = require("../lib/exportShare");
const mongo = require("../lib/mongo");
const {
  logIndiaPostEnvStatus,
  indiaPostCredentialStatus,
} = require("../lib/envCheck");

function createApp() {
  const app = express();

  // Vercel / reverse proxies set X-Forwarded-For — required for express-rate-limit client IPs
  if (process.env.VERCEL || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.use(
    pinoHttp({
      redact: {
        paths: ["req.headers.authorization", "req.body.password"],
        remove: true,
      },
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        if (req.method !== "GET") return false;
        const p = req.path || "";
        if (p === "/track/export-full-report") return true;
        if (/^\/track\/export-full-report\/[^/]+$/.test(p)) return true;
        if (/^\/share\/full-export\/[^/]+$/.test(p)) return true;
        return false;
      },
    }),
  );

  const https = require("https");

  app.get("/health", async (req, res) => {
    try {
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });
  
      const response = await fetch(
        "https://app.indiapost.gov.in/beextcustomer/v1/access/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            username: 3000064964,
            password: 'Viv@k32!',
          }),
          agent,
        }
      );
  
      const data = await response.text();
  
      res.status(200).json({
        success: true,
        data,
      });
  
    } catch (error) {
      console.error(error);
  
      res.status(500).json({
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
    }
  });

  app.get("/track", (req, res) =>
    fail(
      res,
      405,
      "METHOD_NOT_ALLOWED",
      'Use POST /api/track with JSON body: { "consignments": ["EE123456789IN", ...] }',
      { allowed: ["POST"], example: { consignments: ["EE123456789IN"] } },
    ),
  );

  app.post("/auth/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      const username = parsed.data.username.trim();
      const password = parsed.data.password;

      const superUsername = String(
        process.env.SUPERADMIN_USERNAME || "superadmin",
      ).trim();
      const superPassword = String(
        process.env.SUPERADMIN_PASSWORD || "superadmin",
      ).trim();

      if (
        username.toLowerCase() === superUsername.toLowerCase() &&
        password === superPassword
      ) {
        const token = signToken({
          sub: "superadmin",
          role: "superadmin",
          username: superUsername,
        });
        return ok(res, {
          token,
          user: {
            id: "superadmin",
            username: superUsername,
            role: "superadmin",
          },
        });
      }

      const user = await verifyUserCredentials(username, password);
      if (!user)
        throw new AppError("UNAUTHORIZED", "Invalid username or password", 401);

      const token = signToken({
        sub: user.id,
        role: user.role,
        username: user.username,
      });
      return ok(res, { token, user });
    } catch (err) {
      return next(err);
    }
  });

  app.get(
    "/users",
    requireAuth,
    requireRole("superadmin"),
    async (req, res, next) => {
      try {
        const users = await listUsers();
        return ok(res, { count: users.length, items: users });
      } catch (err) {
        return next(err);
      }
    },
  );

  app.post(
    "/users",
    requireAuth,
    requireRole("superadmin"),
    async (req, res, next) => {
      try {
        const parsed = createUserSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          });
        }
        const created = await createUser(parsed.data);
        return ok(res, created);
      } catch (err) {
        return next(err);
      }
    },
  );

  app.delete(
    "/users/:id",
    requireAuth,
    requireRole("superadmin"),
    async (req, res, next) => {
      try {
        await deleteUser(String(req.params.id || ""));
        return ok(res, { deleted: true });
      } catch (err) {
        return next(err);
      }
    },
  );

  app.post(
    "/users/:id/reset-password",
    requireAuth,
    requireRole("superadmin"),
    async (req, res, next) => {
      try {
        const parsed = resetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          });
        }
        await resetUserPassword(
          String(req.params.id || ""),
          parsed.data.password,
        );
        return ok(res, { updated: true });
      } catch (err) {
        return next(err);
      }
    },
  );

  /** Same .xlsx template as used by the app — generated only via `report.js`. */
  app.get("/track/upload-template", (req, res, next) => {
    try {
      const buf = buildUploadTemplateBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${UPLOAD_TEMPLATE_FILENAME}"`,
      );
      res.status(200).send(buf);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/track", async (req, res, next) => {
    try {
      const parsed = trackRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      const consignments = parsed.data.consignments.map((c) => c.toUpperCase());
      const data = await bulkTrack(consignments);
      return ok(res, data);
    } catch (err) {
      return next(err);
    }
  });

  // Download tracking report as pdf/xlsx/csv (generated from tracking response)
  app.post("/track/report", async (req, res, next) => {
    try {
      const parsed = trackReportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      const consignments = parsed.data.consignments.map((c) => c.toUpperCase());
      const format = parsed.data.format;

      const tracking = await bulkTrack(consignments);
      const buf = await buildReportBuffer(format, tracking);
      const meta = createDownloadMeta(format, {
        consignment: consignments.length === 1 ? consignments[0] : undefined,
      });

      res.setHeader("content-type", meta.contentType);
      res.setHeader(
        "content-disposition",
        `attachment; filename="${meta.filename}"`,
      );
      res.status(200).send(buf);
    } catch (err) {
      return next(err);
    }
  });

  /** Queued full ZIP (master XLSX + per-article PDFs) — poll status, then GET …/download */
  app.get("/track/export-full-report", (req, res, next) => {
    try {
      return ok(res, { items: fullExportJob.listJobs() });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/track/export-full-report", async (req, res, next) => {
    try {
      const parsed = trackRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }
      const consignments = parsed.data.consignments.map((c) => c.toUpperCase());
      const jobId = fullExportJob.createJob(consignments);
      return ok(res, { jobId });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/track/export-full-report/:id/download", async (req, res, next) => {
    try {
      const job = fullExportJob.getJob(req.params.id);
      if (!job) {
        throw new AppError("NOT_FOUND", "Export job not found", 404);
      }
      if (job.status !== "done" || !job.filePath) {
        throw new AppError(
          "NOT_READY",
          "Export is still processing, failed, or the file was already downloaded",
          409,
          { status: job.status },
        );
      }
      streamFullExportZip(job, req, res, next);
    } catch (err) {
      return next(err);
    }
  });

  app.post("/track/export-full-report/:id/cancel", (req, res, next) => {
    try {
      const did = fullExportJob.cancelJob(req.params.id);
      if (!did) {
        throw new AppError(
          "NOT_FOUND",
          "Job not found or already finished",
          404,
        );
      }
      return ok(res, { cancelled: true });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/track/export-full-report/:id", (req, res, next) => {
    try {
      const job = fullExportJob.getJob(req.params.id);
      if (!job) {
        throw new AppError("NOT_FOUND", "Export job not found", 404);
      }
      return ok(res, fullExportJob.sanitizeJob(job));
    } catch (err) {
      return next(err);
    }
  });

  function streamFullExportZip(job, req, res, next) {
    if (job.status !== "done" || !job.filePath) {
      throw new AppError(
        "NOT_READY",
        "Export is still processing, failed, or the file was already downloaded",
        409,
        { status: job.status },
      );
    }
    const stamp = new Date(job.createdAt)
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `IndiaPost_Full_Report_${stamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(job.filePath);
    let cleaned = false;
    const cleanupFile = () => {
      if (cleaned) return;
      cleaned = true;
      const p = job.filePath;
      job.filePath = null;
      if (p) fs.unlink(p, () => {});
    };
    stream.on("error", (err) => {
      cleanupFile();
      if (!res.headersSent) next(err);
    });
    res.once("finish", cleanupFile);
    req.once("close", () => {
      if (!res.writableEnded) cleanupFile();
    });
    stream.pipe(res);
  }

  /** Public full ZIP share — no auth; same export queue as dashboard */
  app.post("/share/full-export", async (req, res, next) => {
    try {
      const parsed = trackRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "Invalid request body", 400, {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }
      const consignments = parsed.data.consignments.map((c) => c.toUpperCase());
      const share = await exportShare.createShare(consignments);
      return ok(res, share);
    } catch (err) {
      return next(err);
    }
  });

  app.get("/share/full-export/:token", async (req, res, next) => {
    try {
      const resolved = await exportShare.resolveShareJob(req.params.token);
      if (!resolved) {
        throw new AppError("NOT_FOUND", "Share link not found or expired", 404);
      }
      return ok(res, {
        consignmentCount: resolved.record.consignmentCount,
        generatedAt: resolved.record.generatedAt,
        snapshotDate: resolved.record.snapshotDate,
        snapshotDateLabel: resolved.record.snapshotDateLabel,
        job: fullExportJob.sanitizeJob(resolved.job),
      });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/share/full-export/:token/download", async (req, res, next) => {
    try {
      const resolved = await exportShare.resolveShareJob(req.params.token);
      if (!resolved) {
        throw new AppError("NOT_FOUND", "Share link not found or expired", 404);
      }
      streamFullExportZip(resolved.job, req, res, next);
    } catch (err) {
      return next(err);
    }
  });

  app.use((req, res) => fail(res, 404, "NOT_FOUND", "Route not found"));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    try {
      if (req.log) req.log.error({ err }, "request_failed");
      else console.error("request_failed", err);
    } catch (_) {
      console.error("request_failed", err);
    }

    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return fail(res, 400, "INVALID_JSON", "Request body must be valid JSON", {
        hint: 'POST /api/track with Content-Type: application/json and body { "consignments": ["..."] }',
        parse_error: err.message,
      });
    }

    if (err && err.name === "AppError") {
      return fail(
        res,
        err.status || 500,
        err.code || "APP_ERROR",
        err.message,
        err.details,
      );
    }

    const expose =
      process.env.NODE_ENV !== "production" ||
      process.env.VERCEL_ENV === "preview";
    const message =
      expose && err && err.message ? String(err.message) : "Unexpected error";

    return fail(
      res,
      500,
      "INTERNAL_ERROR",
      message,
      expose && err ? { name: err.name, code: err.code } : undefined,
    );
  });

  return app;
}

async function start() {
  logIndiaPostEnvStatus("server-start");

  try {
    await mongo.connect();
    // eslint-disable-next-line no-console
    console.log("MongoDB connected");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "MongoDB connect failed — share links will not work until MONGODB_URI is set:",
      err && err.message ? err.message : err,
    );
  }

  const app = createApp();
  const port = Number(process.env.PORT || 3000);

  const server = app.listen(port);
  server.requestTimeout = config.serverRequestTimeoutMs;
  server.headersTimeout = config.serverRequestTimeoutMs + 5_000;
  server.on("listening", () => {
    // eslint-disable-next-line no-console
    console.log(`IndiaPost tracking API listening on http://localhost:${port}`);
  });
  server.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(
      "Failed to start server:",
      err && err.message ? err.message : err,
    );
    process.exitCode = 1;
  });
}

module.exports = { createApp, start };
