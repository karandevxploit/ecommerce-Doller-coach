const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/product.model");

const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force to run in production");
  process.exit(1);
}

const slugify = (text) =>
  text.toLowerCase().replace(/\s+/g, "-");

const products = [
  {
    name: "Premium Black Jeans",
    price: 1999,
    mrp: 2499,
    gstPercent: 18,
    category: "men",
    stock: 500,
    sizes: ["30", "32", "34", "36"]
  },
  {
    name: "Classic Overdyed T-Shirt",
    price: 999,
    mrp: 1299,
    gstPercent: 12,
    category: "tshirts",
    stock: 300,
    sizes: ["S", "M", "L", "XL"]
  }
];

const seedProducts = async () => {
  try {
    await connectDB();
    console.log("🚀 Seeding Products...");

    const bulkOps = products.map((p, index) => {
      const slug = slugify(p.name);
      const sku = `SKU-${Date.now()}-${index}`;

      return {
        updateOne: {
          filter: { slug },
          update: {
            $setOnInsert: {
              createdAt: new Date()
            },
            $set: {
              ...p,
              slug,
              sku,
              status: "active",
              description: p.description || "",
              images: [
                `https://cdn.yoursite.com/products/${slug}.jpg`
              ],
              variants: [
                {
                  image: `https://cdn.yoursite.com/products/${slug}.jpg`,
                  sizes: p.sizes
                }
              ]
            }
          },
          upsert: true
        }
      };
    });

    const res = await Product.bulkWrite(bulkOps);

    console.log("✅ Products seeded");
    console.log(`Upserted: ${res.upsertedCount}`);
    console.log(`Modified: ${res.modifiedCount}`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

seedProducts();