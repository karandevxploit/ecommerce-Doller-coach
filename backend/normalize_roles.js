const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/user.model");

async function normalizeRoles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      const oldRole = user.role || "user";
      const newRole = oldRole.toLowerCase();
      if (oldRole !== newRole) {
        user.role = newRole;
        await user.save();
        console.log(`Updated user ${user.email}: ${oldRole} -> ${newRole}`);
      }
    }

    console.log("Role normalization complete");
    process.exit(0);
  } catch (err) {
    console.error("Error normalizing roles:", err);
    process.exit(1);
  }
}

normalizeRoles();
