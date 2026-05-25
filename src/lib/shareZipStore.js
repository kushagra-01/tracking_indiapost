/**
 * GridFS storage for completed share export ZIPs (survives serverless / multi-instance).
 */

const fs = require("fs");
const { ObjectId } = require("mongodb");
const { getShareZipBucket } = require("./mongo");

async function saveZipForToken(token, filePath) {
  const bucket = await getShareZipBucket();
  const uploadStream = bucket.openUploadStream(`share-${token}.zip`, {
    metadata: { token, createdAt: new Date() }
  });

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", resolve);
  });

  return uploadStream.id;
}

async function findZipIdForToken(token) {
  const bucket = await getShareZipBucket();
  const files = await bucket.find({ "metadata.token": String(token) }).sort({ uploadDate: -1 }).limit(1).toArray();
  return files[0]?._id || null;
}

async function openZipDownloadStream(fileId) {
  const bucket = await getShareZipBucket();
  return bucket.openDownloadStream(new ObjectId(String(fileId)));
}

async function deleteZipsForToken(token) {
  const bucket = await getShareZipBucket();
  const files = await bucket.find({ "metadata.token": String(token) }).toArray();
  for (const f of files) {
    await bucket.delete(f._id);
  }
}

module.exports = {
  saveZipForToken,
  findZipIdForToken,
  openZipDownloadStream,
  deleteZipsForToken
};
