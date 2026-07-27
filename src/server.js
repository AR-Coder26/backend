const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const connectCloudinary = require('./config/cloudinary');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    connectCloudinary();

    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

