const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Use standard options for modern Mongoose (v6+)
      autoIndex: true,
      serverSelectionTimeoutMS: 10000, 
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      family: 4, // Force IPv4 to avoid Atlas handshake timeouts in some networks
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle subsequent connection errors
    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB persistent error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB connection lost. Attempting to reconnect...");
    });

    return conn;
  } catch (error) {
    logger.error(`Critical MongoDB Exception: ${error.message}`);
    // In production, we exit to allow the process manager (Render) to restart the service
    process.exit(1);
  }
};

module.exports = connectDB;
