const mongoose = require("mongoose");
const dns = require("dns");

// Configure public DNS servers to resolve mongodb+srv records reliably on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  console.warn("DNS server setup notice:", e.message);
}

const connectDB = async (retryCount = 0) => {
  const maxRetries = 5;
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.error(
      "MongoDB Error: Neither MONGODB_URI nor MONGO_URI environment variable is defined. Please configure this in your environment."
    );
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error (Attempt ${retryCount + 1}/${maxRetries}):`, error.message);
    if (retryCount < maxRetries) {
      console.log(`Retrying MongoDB connection in 3 seconds...`);
      setTimeout(() => connectDB(retryCount + 1), 3000);
    } else {
      console.error("Max MongoDB connection retries reached. Server running with degraded DB access.");
    }
  }
};

module.exports = connectDB;