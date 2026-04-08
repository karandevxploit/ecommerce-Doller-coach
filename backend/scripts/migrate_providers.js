const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/user.model");

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    console.log("Updating all users to have provider='email'...");
    const result = await User.updateMany({}, { $set: { provider: "email" } });
    console.log(`Updated ${result.modifiedCount} users.`);

    console.log("Ensuring admins have corect role/isAdmin flags...");
    const admins = await User.updateMany(
      { $or: [{ role: "admin" }, { isAdmin: true }] },
      { $set: { role: "admin", isAdmin: true } }
    );
    console.log(`Verified ${admins.modifiedCount} admin records.`);

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
