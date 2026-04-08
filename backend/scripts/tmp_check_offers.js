const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const offerSchema = new mongoose.Schema({}, { strict: false });
const Offer = mongoose.model("Offer", offerSchema);

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await Offer.countDocuments();
    console.log("OFFER_COUNT:", count);
    const all = await Offer.find().lean();
    console.log("OFFER_DATA:", JSON.stringify(all, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
