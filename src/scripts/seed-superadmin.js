require("dotenv").config();

const { ensureDefaultSuperAdmin } = require("../lib/userStore");
const mongo = require("../lib/mongo");

async function main() {
  await mongo.connect();
  const user = await ensureDefaultSuperAdmin();
  if (!user) {
    // eslint-disable-next-line no-console
    console.error("MONGODB_URI is required to seed superadmin");
    process.exitCode = 1;
    return;
  }
  // eslint-disable-next-line no-console
  console.log("Superadmin user:", user);
  await mongo.closeMongo();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
