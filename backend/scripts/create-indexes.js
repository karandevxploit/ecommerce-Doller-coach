#!/usr/bin/env node

const mongoose = require("mongoose");
const { structuredLog } = require("../utils/logger");

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    const db = mongoose.connection.db;

    structuredLog.business("Connected to MongoDB");

    /**
     * SAFE CREATE INDEX
     */
    const safeCreate = async (collection, indexes) => {
      const existing = await db.collection(collection).indexes();
      const existingNames = new Set(existing.map(i => i.name));

      const filtered = indexes.filter(i => !existingNames.has(i.name));

      if (filtered.length) {
        structuredLog.info(`Creating ${filtered.length} indexes on ${collection}`);
        await db.collection(collection).createIndexes(
          filtered.map(i => ({ ...i, background: true }))
        );
      } else {
        structuredLog.info(`No new indexes needed for ${collection}`);
      }
    };

    /**
     * PRODUCTS
     */
    await safeCreate("products", [
      { key: { category: 1, createdAt: -1 }, name: "category_createdAt" },
      { key: { featured: 1, createdAt: -1 }, name: "featured_createdAt" },
      { key: { trending: 1, createdAt: -1 }, name: "trending_createdAt" },
      { key: { price: 1 }, name: "price_index" },
      { key: { stock: 1 }, name: "stock_index" },
      { key: { createdAt: -1 }, name: "createdAt_index" },
      { key: { title: "text", description: "text", brand: "text" }, name: "search_text" }
    ]);

    /**
     * USERS
     */
    await safeCreate("users", [
      { key: { email: 1 }, name: "email_unique", unique: true },
      { key: { role: 1, createdAt: -1 }, name: "role_createdAt" },
      { key: { emailVerified: 1 }, name: "emailVerified_index" }
    ]);

    /**
     * ORDERS
     */
    await safeCreate("orders", [
      { key: { userId: 1, createdAt: -1 }, name: "userId_createdAt" },
      { key: { status: 1, createdAt: -1 }, name: "status_createdAt" },
      { key: { paymentStatus: 1, createdAt: -1 }, name: "paymentStatus_createdAt" },
      { key: { "products.productId": 1 }, name: "product_orders_index" }
    ]);

    /**
     * OFFERS (FIXED)
     */
    await safeCreate("offers", [
      { key: { isActive: 1, startDate: 1, endDate: 1 }, name: "active_dates" },
      { key: { discountType: 1 }, name: "discountType_index" },
      { key: { endDate: 1 }, name: "expiry_index" }
    ]);

    /**
     * NOTIFICATIONS (FIXED)
     */
    await safeCreate("notifications", [
      { key: { userId: 1, createdAt: -1 }, name: "userId_createdAt" },
      { key: { readAt: 1 }, name: "readAt_index" }
    ]);

    /**
     * WISHLIST (FIXED)
     */
    await safeCreate("wishlists", [
      { key: { userId: 1 }, name: "userId_index" },
      { key: { "items.productId": 1 }, name: "productId_index" }
    ]);

    /**
     * CART
     */
    await safeCreate("carts", [
      { key: { userId: 1 }, name: "userId_index" },
      { key: { "items.productId": 1 }, name: "cart_product_index" }
    ]);

    /**
     * REVIEWS
     */
    await safeCreate("reviews", [
      { key: { product: 1, createdAt: -1 }, name: "product_createdAt" },
      { key: { user: 1, product: 1 }, name: "user_product_unique", unique: true }
    ]);

    structuredLog.business("All indexes created safely");

  } catch (err) {
    structuredLog.error("Index creation failed", { error: err.message });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  createIndexes();
}

module.exports = { createIndexes };