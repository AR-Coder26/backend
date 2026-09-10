const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
let cached = { conn: null, promise: null };

const connectDB = async () => {
  // Already connected and healthy - warm container, instant return, no network call at all.
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 0, // serverless containers can freeze/die - don't hold idle connections open
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 10000,
        family: 4,
        bufferCommands: false, // fail fast with a real error instead of hanging queries if not connected
      })
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host} | DB: ${conn.connection.name}`);

        conn.connection.on('error', (err) => {
          console.error(`MongoDB connection error: ${err.message}`);
        });

        conn.connection.on('disconnected', () => {
          console.warn('MongoDB disconnected. Will reconnect on next request.');
          cached.conn = null;
          cached.promise = null;
        });

        return conn;
      })
      .catch((error) => {
        // Reset so the NEXT request gets a fresh attempt instead of being stuck on a rejected
        // promise forever (which would permanently break every request on this warm container).
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  cached = { conn: null, promise: null };
  console.log('MongoDB connection closed gracefully.');
};

module.exports = { connectDB, disconnectDB };