const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const dotenv = require("dotenv");
const User = require("../models/user.model");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = "karanyadav.hack.dev@gmail.com";
  const passwordText = "Karan@7409";
  const hashedPassword = await bcrypt.hash(passwordText, 10);
  
  const adminData = {
    name: "Karan Yadav",
    email,
    password: hashedPassword,
    role: "admin",
    isAdmin: true,
    emailVerified: true,
    phoneVerified: true,
    isVerified: true,
  };

  const exists = await User.findOne({ email });
  if (exists) {
    await User.updateOne({ email }, { $set: adminData });
    console.log(`Admin user updated: ${email} / ${passwordText}`);
  } else {
    await User.create(adminData);
    console.log(`Admin user created: ${email} / ${passwordText}`);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

