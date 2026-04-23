const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const SiteContent = require("../backend/models/siteContent.model");

async function checkContent() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/doller-coa");
    console.log("Connected to DB");

    const content = await SiteContent.findOne();
    if (!content) {
      console.log("No site content found in DB.");
    } else {
      console.log("Site content found:");
      console.log(JSON.stringify(content, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkContent();
