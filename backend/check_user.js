const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const User = require("./models/user.model");

dotenv.config({ path: path.join(__dirname, ".env") });

async function checkUser() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = "karanyadav.hack.dev@gmail.com";
  const user = await User.findOne({ email });
  if (user) {
    console.log("User found:");
    console.log({
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      isVerified: user.isVerified
    });
  } else {
    console.log("User not found");
  }
  process.exit(0);
}

checkUser().catch(err => {
  console.error(err);
  process.exit(1);
});
