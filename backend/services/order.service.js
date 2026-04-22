const productRepository = require("../repositories/product.repository");
const orderRepository = require("../repositories/order.repository");
const Coupon = require("../models/coupon.model");
const Offer = require("../models/offer.model");
const { logger } = require("../utils/logger");

class OrderService {
  async validateCartAndCalculateTotal(products, couponCode = null) {
    let subtotal = 0;
    const validatedProducts = [];

    const productIds = products.map((p) => p.productId);
    const dbProducts = await productRepository.model.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    for (const item of products) {
      const product = productMap.get(item.productId.toString());
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name || product.title}`);
      }

      const price = product.discountPrice > 0 ? product.discountPrice : product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      validatedProducts.push({
        productId: product._id,
        title: product.name || product.title,
        quantity: item.quantity,
        price: price,
        size: item.size,
        topSize: item.topSize,
        bottomSize: item.bottomSize,
      });
    }

    let discountAmount = 0;
    let appliedDiscount = null;
    let discountSource = null; // "coupon" or "offer"

    if (couponCode) {
      const code = couponCode.toUpperCase().trim();
      
      // 1. Sequential Lookup: First check Coupons, then check Offers
      let discountData = await Coupon.findOne({
        code: { $regex: `^${code}$`, $options: "i" }
      });

      if (discountData) {
        discountSource = "coupon";
      } else {
        discountData = await Offer.findOne({
          couponCode: { $regex: `^${code}$`, $options: "i" },
          isActive: true
        });
        if (discountData) discountSource = "offer";
      }

      if (!discountData || !discountData.isActive) {
        throw new Error("Invalid or inactive coupon");
      }
      
      const now = new Date();
      const startDate = discountData.startDate || null;
      const endDate = discountData.endDate || discountData.expiryDate || null;

      if (startDate && now < new Date(startDate)) {
        throw new Error("Coupon not yet active");
      }

      if (endDate && now > new Date(endDate)) {
        throw new Error("Coupon expired");
      }
      
      const limit = discountData.usageLimit || 0;
      if (limit > 0 && discountData.usedCount >= limit) {
        throw new Error("Coupon usage limit reached");
      }
      
      // Standardized Property: Use minOrderAmount (fallback to minOrderValue for legacy)
      const minAmount = discountData.minOrderAmount ?? discountData.minOrderValue ?? 0;
      if (subtotal < minAmount) {
        throw new Error(`Minimum order of \u20B9${minAmount} required for this discount`);
      }

      if (discountData.discountType === "percentage") {
        discountAmount = (subtotal * discountData.discountValue) / 100;
        const maxDisc = discountData.maxDiscount ?? null;
        if (maxDisc !== null) {
          discountAmount = Math.min(discountAmount, maxDisc);
        }
      } else {
        // Handle "flat" type in Offers vs "fixed" in Coupons
        discountAmount = discountData.discountValue;
      }

      discountAmount = Math.min(discountAmount, subtotal);
      appliedDiscount = discountData;
    }

    // Absolute Backend Logic: GST 18%, Delivery 0
    const gst = Math.round(subtotal * 0.18);
    const delivery = 0;
    const discount = discountAmount;
    const total = subtotal - discount + gst + delivery;

    return {
      products: validatedProducts,
      subtotal,
      discount,
      delivery,
      gst,
      total,
      gstPercent: 18,
      coupon: appliedDiscount ? { 
        code: appliedDiscount.code || appliedDiscount.couponCode, 
        id: appliedDiscount._id,
        source: discountSource 
      } : null,
    };
  }

  async createOrder(userId, orderData) {
    const { 
      products, subtotal, discount, 
      delivery, gst, total, 
      address, paymentMethod, couponCode 
    } = orderData;
    const mongoose = require("mongoose");
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Atomic stock check and decrease
      for (const item of products) {
        // Find and update if stock >= quantity
        const updatedProduct = await productRepository.model.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );

        if (!updatedProduct) {
          throw new Error(`Insufficient stock for ${item.title} or product was updated during checkout.`);
        }
      }

      // 2. Prepare shipping address
      let shippingAddress = {};
      if (typeof address === "object") {
        shippingAddress = {
          name: address.name || "",
          phone: address.phone || "",
          address: address.address || address.addressLine1 || "",
          city: address.city || "",
          state: address.state || "",
          pincode: address.pincode || "",
        };
      }

      const cleanAddressString = typeof address === "object" 
        ? `${address.address || address.addressLine1 || ""}, ${address.city || ""}, ${address.state || ""} - ${address.pincode || ""}`
        : address;

      // 3. Absolute Persistence Manifest: Re-calculate GST (18%) and Total on the fly
      const finalGst = Math.round(subtotal * 0.18);
      const finalTotal = subtotal - discount + finalGst;

      const order = await orderRepository.create({
        userId,
        products,
        subtotal,
        discount,
        delivery: 0, // Enforced Free Delivery
        gst: finalGst,
        total: finalTotal,
        shippingAddress,
        paymentMethod,
        couponCode: couponCode ? couponCode.toUpperCase() : null,
        status: "placed",
      }, { session });

      console.log("ORDER SAVED:", JSON.stringify({ 
        id: order._id, 
        subtotal: order.subtotal, 
        gst: order.gst, 
        total: order.total 
      }, null, 2));

      // 4. Finalize coupon usage (Atomic check & increment)
      if (couponCode) {
        const code = couponCode.toUpperCase().trim();
        
        // Atomic attempt to claim a coupon slot
        let couponUpdate = await Coupon.findOneAndUpdate(
          { code, $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
          { $inc: { usedCount: 1 } },
          { session, new: true }
        );

        // If not found in Coupons, stay within same transaction and try Offers
        if (!couponUpdate) {
          couponUpdate = await Offer.findOneAndUpdate(
            { couponCode: code, isActive: true, $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
            { $inc: { usedCount: 1 } },
            { session, new: true }
          );
        }

        if (!couponUpdate) {
          throw new Error("Coupon usage limit reached or coupon deactivated during processing.");
        }
      }

      await session.commitTransaction();
      return order;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Order Creation Transaction Failed: ${error.message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async finalizeCouponUsage(couponCode, session = null) {
    if (!couponCode) return;
    try {
      const code = couponCode.toUpperCase().trim();
      const options = session ? { session } : {};
      
      // Try to update Coupon first
      const couponUpdate = await Coupon.updateOne(
        { code },
        { $inc: { usedCount: 1 } },
        options
      );

      // If not a coupon, try to update Offer
      if (couponUpdate.matchedCount === 0) {
        await Offer.updateOne(
          { couponCode: code },
          { $inc: { usedCount: 1 } },
          options
        );
      }
    } catch (err) {
      logger.error(`Failed to increment usage for ${couponCode}: ${err.message}`);
    }
  }

}

module.exports = new OrderService();
