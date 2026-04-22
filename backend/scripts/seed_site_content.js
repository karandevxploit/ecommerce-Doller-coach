const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const SiteContent = require("../models/siteContent.model");

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

const SINGLETON_ID = "SITE_CONTENT_SINGLETON";

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force to run in production");
  process.exit(1);
}

async function seedSiteContent() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log("🚀 Seeding SiteContent...");

    const defaultData = {
      _id: SINGLETON_ID,

      heroCarousel: [
        {
          image: "https://cdn.yoursite.com/hero1.jpg",
          heading: "Urban Excellence",
          subheading: "Summer 24 Collection",
          offer: {
            text: "20% OFF FIRST ORDER",
            enabled: true
          },
          order: 0
        },
        {
          image: "https://cdn.yoursite.com/hero2.jpg",
          heading: "Modern Identity",
          subheading: "Doller Coach Signature",
          offer: {
            text: "Buy 1 Get 1 Free",
            enabled: true,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          },
          order: 1
        }
      ],

      headings: {
        bestSellersTitle: "Best Sellers",
        trendingTitle: "Trending Now",
        newArrivalsTitle: "New Arrivals"
      },

      banners: {
        promoBanner: {
          image: "https://cdn.yoursite.com/banner.jpg",
          text: "Limited Invitation",
          subtext: "Summer 24 Core Collection"
        }
      },

      version: 1
    };

    if (DRY_RUN) {
      console.log("🧪 DRY RUN:", JSON.stringify(defaultData, null, 2));
      process.exit(0);
    }

    const result = await SiteContent.findOneAndUpdate(
      { _id: SINGLETON_ID },
      {
        $setOnInsert: defaultData,
        $set: {
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    console.log("✅ SiteContent ready:", result._id);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Seed Error:", err);
    process.exit(1);
  }
}

seedSiteContent();