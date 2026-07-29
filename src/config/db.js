const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });

    console.log(`MongoDB Connected: ${conn.connection.host} | DB: ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Driver will attempt to reconnect automatically.');
    });

    return conn;
  } catch (error) {
    console.error(`Initial MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed gracefully.');
};

module.exports = { connectDB, disconnectDB };