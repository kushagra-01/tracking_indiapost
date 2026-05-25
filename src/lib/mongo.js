/**
 * MongoDB connection for share links and other persisted metadata.
 */

const dns = require("dns");
const { MongoClient, ServerApiVersion } = require("mongodb");
const config = require("./config");

/**
 * Node on Windows often gets `querySrv ECONNREFUSED` when using router/link-local DNS.
 * Public resolvers fix Atlas `mongodb+srv://` lookups. Set MONGODB_DNS_SERVERS=system to disable.
 */
function configureMongoDns() {
  const raw = process.env.MONGODB_DNS_SERVERS;
  if (raw === "system") return;
  if (raw) {
    dns.setServers(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    return;
  }
  if (process.platform === "win32") {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  }
}

configureMongoDns();

function mongoClientOptions() {
  const opts = {};
  if (config.mongoUri && String(config.mongoUri).startsWith("mongodb+srv://")) {
    opts.serverApi = {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    };
  }
  return opts;
}

const EXPORT_SHARES = "export_shares";
const USERS = "users";
const APP_SETTINGS = "app_settings";
const CONSIGNMENT_CACHE = "consignment_cache";
const SHARE_ZIP_BUCKET = "share_export_zips";

let client;
let database;
let connectPromise;

async function ensureShareIndexes(col) {
  await col.createIndex({ token: 1 }, { unique: true });
  await col.createIndex({ jobId: 1 });
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

async function ensureUserIndexes(col) {
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ username: 1 }, { unique: true });
  await col.createIndex({ usernameLower: 1 }, { unique: true });
}

async function ensureConsignmentCacheIndexes(col) {
  await col.createIndex({ consignment: 1 }, { unique: true });
  await col.createIndex({ searchedAt: 1 });
}

async function ensureShareZipIndexes(db) {
  const files = db.collection(`${SHARE_ZIP_BUCKET}.files`);
  await files.createIndex({ "metadata.token": 1, uploadDate: -1 });
}

async function connect() {
  if (database) return database;
  if (!connectPromise) {
    connectPromise = (async () => {
      client = new MongoClient(config.mongoUri, mongoClientOptions());
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      database = client.db(config.mongoDbName);
      await ensureShareIndexes(database.collection(EXPORT_SHARES));
      await ensureUserIndexes(database.collection(USERS));
      await ensureConsignmentCacheIndexes(database.collection(CONSIGNMENT_CACHE));
      await ensureShareZipIndexes(database);
      return database;
    })().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

async function getExportSharesCollection() {
  const db = await connect();
  return db.collection(EXPORT_SHARES);
}

async function getUsersCollection() {
  const db = await connect();
  return db.collection(USERS);
}

async function getAppSettingsCollection() {
  const db = await connect();
  return db.collection(APP_SETTINGS);
}

async function getConsignmentCacheCollection() {
  const db = await connect();
  return db.collection(CONSIGNMENT_CACHE);
}

async function getShareZipBucket() {
  const db = await connect();
  const { GridFSBucket } = require("mongodb");
  return new GridFSBucket(db, { bucketName: SHARE_ZIP_BUCKET });
}

function isConnected() {
  return Boolean(database);
}

async function closeMongo() {
  if (client) {
    await client.close();
  }
  client = null;
  database = null;
  connectPromise = null;
}

module.exports = {
  connect,
  closeMongo,
  getExportSharesCollection,
  getUsersCollection,
  getAppSettingsCollection,
  getConsignmentCacheCollection,
  getShareZipBucket,
  isConnected,
  EXPORT_SHARES,
  USERS,
  APP_SETTINGS,
  CONSIGNMENT_CACHE,
  SHARE_ZIP_BUCKET
};
