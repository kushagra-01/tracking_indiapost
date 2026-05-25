/**
 * MongoDB connection for share links and other persisted metadata.
 */

const { MongoClient } = require("mongodb");
const config = require("./config");

const EXPORT_SHARES = "export_shares";
const USERS = "users";

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

async function connect() {
  if (database) return database;
  if (!connectPromise) {
    connectPromise = (async () => {
      client = new MongoClient(config.mongoUri);
      await client.connect();
      database = client.db(config.mongoDbName);
      await ensureShareIndexes(database.collection(EXPORT_SHARES));
      await ensureUserIndexes(database.collection(USERS));
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
  isConnected,
  EXPORT_SHARES,
  USERS
};
