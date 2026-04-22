const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const Product = require("./models/product.model");

async function checkDummyImages() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const dummyUrl = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea";

  const productsWithDummy = await Product.find({
    images: { $regex: dummyUrl }
  });

  console.log(`Found ${productsWithDummy.length} products with dummy images.`);

  productsWithDummy.forEach(p => {
    console.log(`- ${p.title} (${p.category})`);
  });

  process.exit(0);
}

checkDummyImages().catch(err => {
  console.error(err);
  process.exit(1);
});
