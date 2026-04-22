const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/product.model");
const fs = require("fs");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
    console.error("❌ BLOCKED: Use --force to run in production");
    process.exit(1);
}

const PRODUCTS = [
    {
        key: "denim-shirt", // use slug or unique field
        update: {
            images: ["https://cdn.yoursite.com/products/denim_shirt_v1.png"],
            primaryImage: "https://cdn.yoursite.com/products/denim_shirt_v1.png",
            isNewlyLaunched: true,
            description:
                "Premium light blue denim shirt with a modern architecture fit. Crafted from high-density cotton."
        }
    },
    {
        key: "silk-blouse",
        update: {
            name: "Designer White Satin Silk Blouse",
            title: "Designer White Satin Silk Blouse",
            images: ["https://cdn.yoursite.com/products/silk_blouse_v1.png"],
            primaryImage: "https://cdn.yoursite.com/products/silk_blouse_v1.png",
            isNewlyLaunched: true,
            category: "women",
            description:
                "Luxury satin silk blouse with a premium drape and minimalist high-end design."
        }
    }
];

async function migrate() {
    await connectDB();

    const session = await mongoose.startSession();
    session.startTransaction();

    const audit = [];

    try {
        for (const item of PRODUCTS) {
            const product = await Product.findOne({ slug: item.key }).session(session);

            if (!product) {
                console.warn(`⚠️ Product not found: ${item.key}`);
                continue;
            }

            audit.push({
                id: product._id,
                before: {
                    name: product.name,
                    image: product.primaryImage
                },
                after: item.update
            });

            if (!DRY_RUN) {
                await Product.updateOne(
                    { _id: product._id },
                    { $set: item.update },
                    { session }
                );
            }

            console.log(`✅ Prepared update: ${item.key}`);
        }

        if (DRY_RUN) {
            console.log("🧪 DRY RUN - No changes applied");
            await session.abortTransaction();
        } else {
            await session.commitTransaction();
            console.log("🎉 Migration committed");
        }

        fs.writeFileSync(
            `product_migration_log_${Date.now()}.json`,
            JSON.stringify(audit, null, 2)
        );

    } catch (err) {
        await session.abortTransaction();
        console.error("❌ Migration failed:", err.message);
    } finally {
        session.endSession();
        process.exit(0);
    }
}

migrate();