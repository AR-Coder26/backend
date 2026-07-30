const errorHandler = (err, req, res, next) => {
  let statusCode =
    err.statusCode ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Internal Server Error";
  let errors = err.errors && err.errors.length > 0 ? err.errors : undefined;

  // Invalid MongoDB ObjectId (e.g. /api/products/invalid-id)
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
  }

  // Duplicate key error (e.g. same SKU/email inserted twice)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value entered for field: ${field}`;
  }

  // Mongoose schema validation failure
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired, please log in again";
  }
  // Multer file-upload errors (oversized image, wrong field name, etc.) are client mistakes,
  if (err.name === 'MulterError') {
  statusCode = 400;
  message = err.code === 'LIMIT_FILE_SIZE' ? 'Image file is too large (max 5MB allowed)' : err.message;
  }
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorHandler;
