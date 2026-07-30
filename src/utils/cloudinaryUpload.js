const { cloudinary } = require('../config/cloudinary');

// Uploads an in-memory buffer (from multer's memoryStorage) directly to Cloudinary via a stream -
// no temp file is ever written to disk, so there's nothing to clean up if the request fails midway.
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', format: 'webp' }, // auto-convert to WebP per the approved tech spec
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// Best-effort cleanup of an old image when it's replaced. Deliberately does NOT throw -
// a failed cleanup delete should never block the main create/update operation from succeeding.
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, err.message);
  }
};

module.exports = { uploadBufferToCloudinary, deleteFromCloudinary };