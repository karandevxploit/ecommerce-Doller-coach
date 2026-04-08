const productRepository = require("../repositories/product.repository");
const orderRepository = require("../repositories/order.repository");
const Coupon = require("../models/coupon.model");
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
    let appliedCoupon = null;

    if (couponCode) {
      const code = couponCode.toUpperCase().trim();
      
      const coupon = await Coupon.findOne({
        code: { $regex: `^${code}$`, $options: "i" }
      });
      
      console.log("Coupon Input:", couponCode);
      console.log("Coupon Found:", coupon);

      if (!coupon || !coupon.isActive) {
        throw new Error("Invalid or inactive coupon");
      }
      
      const now = new Date();

      if (coupon.startDate && now < coupon.startDate) {
        throw new Error("Coupon not started");
      }

      const effectiveEndDate = coupon.endDate || coupon.expiryDate;
      if (effectiveEndDate && now > new Date(effectiveEndDate)) {
        throw new Error("Coupon expired");
      }
      
      const limit = coupon.usageLimit || coupon.limit; // handle any potential field naming differences
      if (limit !== null && coupon.usedCount >= limit) {
        throw new Error("Coupon limit reached");
      }
      
      if (subtotal < coupon.minOrderValue) {
        throw new Error(`Minimum order value of ${coupon.minOrderValue} not met for this coupon`);
      }

      if (coupon.discountType === "percentage") {
        discountAmount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount !== null) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscount);
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      // Ensure discount doesn't exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal);
      appliedCoupon = coupon;
    }

    const totalAmount = subtotal - discountAmount;

    return {
      products: validatedProducts,
      subtotalAmount: subtotal,
      discountAmount,
      totalAmount,
      coupon: appliedCoupon ? { code: appliedCoupon.code, id: appliedCoupon._id } : null,
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
      await Coupon.updateOne(
        { code: couponCode.toUpperCase() },
        { $inc: { usedCount: 1 } }
      );
    } catch (err) {
      logger.error(`Failed to increment coupon ${couponCode}: ${err.message}`);
    }
  }
}

module.exports = new OrderService();
