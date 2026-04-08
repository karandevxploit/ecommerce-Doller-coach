const productRepository = require("../repositories/product.repository");
const orderRepository = require("../repositories/order.repository");
const Coupon = require("../models/coupon.model");
const Offer = require("../models/offer.model");
const logger = require("../utils/logger");

class OrderService {
  async validateCartAndCalculateTotal(products, couponCode = null) {
    let subtotal = 0;
    const validatedProducts = [];

    for (const item of products) {
      const product = await productRepository.findById(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      const price = product.discountPrice > 0 ? product.discountPrice : product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      validatedProducts.push({
        productId: product._id,
        title: product.name,
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

    const totalAmount = subtotal - discountAmount;

    return {
      products: validatedProducts,
      subtotalAmount: subtotal,
      discountAmount,
      totalAmount,
      coupon: appliedDiscount ? { 
        code: appliedDiscount.code || appliedDiscount.couponCode, 
        id: appliedDiscount._id,
        source: discountSource 
      } : null,
    };
  }

  async createOrder(userId, orderData) {
    const { products, subtotalAmount, discountAmount, totalAmount, address, paymentMethod, couponCode } = orderData;

    // Atomic stock check and decrease
    for (const item of products) {
      const updatedProduct = await productRepository.updateStock(item.productId, -item.quantity);
      if (updatedProduct.stock < 0) {
        // Rollback already decreased stock (simplified, for better consistency use a transaction)
        // This is a basic mitigation without sessions
        await productRepository.updateStock(item.productId, item.quantity);
        throw new Error(`Stock ran out for ${item.title} during order placement`);
      }
    }

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

    // VERIFICATION: Check if phone number exists in shippingAddress
    if (typeof address === "object" && !shippingAddress.phone) {
      console.warn("[Order Service] WARNING: Missing phone number in address object for order creation.");
    }

    console.log("[Order Service] Final shippingAddress object before save:", JSON.stringify(shippingAddress, null, 2));

    const cleanAddressString = typeof address === "object" 
      ? `${address.address || address.addressLine1 || ""}, ${address.city || ""}, ${address.state || ""} - ${address.pincode || ""}`
      : address;

    const order = await orderRepository.create({
      userId,
      products,
      subtotalAmount,
      discountAmount,
      totalAmount,
      // Legacy string field now contains ONLY the address (no name or phone)
      address: cleanAddressString,
      shippingAddress,
      paymentMethod,
      couponCode,
      status: "placed",
    });

    return order;
  }

  async finalizeCouponUsage(couponCode) {
    if (!couponCode) return;
    try {
      const code = couponCode.toUpperCase().trim();
      
      // Try to update Coupon first
      const couponUpdate = await Coupon.updateOne(
        { code },
        { $inc: { usedCount: 1 } }
      );

      // If not a coupon, try to update Offer
      if (couponUpdate.matchedCount === 0) {
        await Offer.updateOne(
          { couponCode: code },
          { $inc: { usedCount: 1 } }
        );
      }
    } catch (err) {
      logger.error(`Failed to increment usage for ${couponCode}: ${err.message}`);
    }
  }
}

module.exports = new OrderService();
