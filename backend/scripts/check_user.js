const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

const User = require("./models/user.model");

dotenv.config({ path: path.join(__dirname, ".env") });

const TIMEOUT = 5000;

/**
 * CLI ARG PARSER
 */
const args = process.argv.slice(2);
const emailArg = args.find(a => a.startsWith("--email="));
const email = emailArg ? emailArg.split("=")[1] : null;

if (!email) {
  console.error("❌ Usage: node checkUser.js --email=user@example.com");
  process.exit(1);
}

/**
 * Timeout wrapper
 */
const withTimeout = (promise, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), TIMEOUT)
    ),
  ]);
};

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      maxPoolSize: 5,
    });

    console.log(`🔍 Searching user: ${email}`);

    /**
     * SAFE QUERY (PROJECTION)
     */
    const user = await withTimeout(
      User.findOne({ email }).select(
        "email role emailVerified phoneVerified isVerified createdAt"
      ).lean(),
      "User Query"
    );

    if (!user) {
      console.log("⚠️ User not found");
      return;
    }

    /**
     * STRUCTURED OUTPUT
     */
    console.log("✅ User Found:");
    console.log(JSON.stringify(user, null, 2));

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

checkUser();