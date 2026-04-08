const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/user.model");

async function hardResetProviders() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI is missing from .env");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for Hard Reset");

    // 1. Force ALL users to provider: 'email'
    const res1 = await User.updateMany(
      {},
      { $set: { provider: "email" } }
    );
    console.log(`Hard Reset: Updated ${res1.modifiedCount} users to provider: 'email'`);

    // 2. Fix any lingering invalid values (nin check)
    const res2 = await User.updateMany(
      { provider: { $nin: ["email", "google", "github"] } },
      { $set: { provider: "email" } }
    );
    console.log(`Persistence check: Updated ${res2.modifiedCount} users with invalid provider values`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (err) {
    console.error("Hard Reset failed:", err);
    process.exit(1);
  }
}

hardResetProviders();
