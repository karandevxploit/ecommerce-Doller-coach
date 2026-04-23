const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "backend", ".env") });
const User = require("./backend/models/user.model");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: "karanyadav.hack.dev@gmail.com" }).lean();
  console.log("USER DATA:", JSON.stringify(user, null, 2));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
