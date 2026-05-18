const productRepository = require("../repositories/product.repository");
const Coupon = require("../models/coupon.model");
const Offer = require("../models/offer.model");
const Order = require("../models/order.model");
const User = require("../models/user.model");
const { logger } = require("../utils/logger");
const { sendAdminOrderEmail } = require("../utils/sendEmail");

const GST_PERCENT = 18;
const DELIVERY_FEE = 40;
const COD_FEE = 50;

class OrderService {
  async validateCartAndCalculateTotal(products, couponCode = null, paymentMethod = "COD") {
    let subtotal = 0;
    const validatedProducts = [];

    const productIds = products.map((p) => p.productId);
    const dbProducts = await productRepository.model.find({
      _id: { $in: productIds },
      isDeleted: { $ne: true },
      status: "active",
    }).lean();
    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    for (const item of products) {
      const product = productMap.get(item.productId.toString());
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name || product.title}`);
      }

      const price = Number(product.price) || Number(item.price) || 0;
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
        color: item.color,
        image: product.primaryImage || product.images?.[0] || "",
        sku: product.sku || "",
      });
    }

    let discountAmount = 0;
    let appliedDiscount = null;
    let discountSource = null; // "coupon" or "offer"

    if (couponCode) {
      const code = couponCode.toUpperCase().trim();
      
      // 1. Sequential Lookup: First check Coupons, then check Offers
      let discountData = await Coupon.findOne({
        code,
        isDeleted: { $ne: true },
      });

      if (discountData) {
        discountSource = "coupon";
      } else {
        discountData = await Offer.findOne({
          couponCode: code,
          isActive: true,
          isDeleted: { $ne: true },
        });
        if (discountData) discountSource = "offer";
      }

      if (!discountData || !discountData.isActive) {
        throw new Error("Invalid or inactive coupon");
      }
      
      const now = new Date();
      const startDate = discountData.startDate || discountData.validFrom || null;
      const endDate = discountData.endDate || discountData.expiryDate || discountData.validTill || null;

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

    const gst = Math.round(subtotal * (GST_PERCENT / 100));
    const delivery = DELIVERY_FEE;
    const codFee = String(paymentMethod || "").toUpperCase() === "COD" ? COD_FEE : 0;
    const discount = discountAmount;
    const total = subtotal - discount + gst + delivery + codFee;

    return {
      products: validatedProducts,
      subtotal,
      discount,
      delivery,
      codFee,
      gst,
      total,
      gstPercent: GST_PERCENT,
      coupon: appliedDiscount ? { 
        code: appliedDiscount.code || appliedDiscount.couponCode, 
        id: appliedDiscount._id,
        source: discountSource 
      } : null,
    };
  }

  async createOrder(userId, orderData, externalSession = null) {
    const {
      products, subtotal, discount, 
      delivery, gst, total, codFee,
      address, shippingAddress: providedShippingAddress, paymentMethod, couponCode
    } = orderData;
    const ownsSession = !externalSession;
    const session = externalSession || await require("mongoose").startSession();
    if (ownsSession) session.startTransaction();

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
      const sourceAddress = typeof address === "object" ? address : providedShippingAddress;
      let shippingAddress = {};
      if (typeof sourceAddress === "object" && sourceAddress) {
        shippingAddress = {
          fullName: sourceAddress.fullName || sourceAddress.name || "",
          phone: sourceAddress.phone || "",
          addressLine1: sourceAddress.addressLine1 || sourceAddress.street || sourceAddress.address || "",
          addressLine2: sourceAddress.addressLine2 || "",
          landmark: sourceAddress.landmark || "",
          city: sourceAddress.city || "",
          state: sourceAddress.state || "",
          pincode: sourceAddress.pincode || "",
        };
      }

      const finalGst = Math.round(subtotal * (GST_PERCENT / 100));
      const finalDelivery = DELIVERY_FEE;
      const finalCodFee = String(paymentMethod || "").toUpperCase() === "COD" ? COD_FEE : 0;
      const finalTotal = subtotal - discount + finalGst + finalDelivery + finalCodFee;

      const [order] = await Order.create([{
        userId,
        products,
        subtotal,
        discount,
        delivery: finalDelivery,
        codFee: finalCodFee,
        gst: finalGst,
        gstPercent: GST_PERCENT,
        total: finalTotal,
        shippingAddress,
        paymentMethod,
        couponCode: couponCode ? couponCode.toUpperCase() : null,
        status: "placed",
      }], { session });

      // 4. Finalize coupon usage for COD immediately. Online orders finalize after payment success.
      if (couponCode && paymentMethod === "COD") {
        const code = couponCode.toUpperCase().trim();
        
        // Atomic attempt to claim a coupon slot
        let couponUpdate = await Coupon.findOneAndUpdate(
          { code, isDeleted: { $ne: true }, $or: [{ usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
          { $inc: { usedCount: 1 } },
          { session, new: true }
        );

        // If not found in Coupons, stay within same transaction and try Offers
        if (!couponUpdate) {
          couponUpdate = await Offer.findOneAndUpdate(
            { couponCode: code, isActive: true, isDeleted: { $ne: true }, $or: [{ usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
            { $inc: { usedCount: 1 } },
            { session, new: true }
          );
        }

        if (!couponUpdate) {
          throw new Error("Coupon usage limit reached or coupon deactivated during processing.");
        }
      }

      if (ownsSession) await session.commitTransaction();

      setImmediate(async () => {
        try {
          const customer = await User.findById(userId).select("name email").lean();
          await sendAdminOrderEmail({
            order: order.toObject ? order.toObject() : order,
            customer,
          });
        } catch (mailError) {
          logger.error("[ORDER_ADMIN_EMAIL_FAILED]", {
            orderId: String(order?._id || ""),
            error: mailError.message,
          });
        }
      });

      return order;
    } catch (error) {
      if (ownsSession) await session.abortTransaction();
      logger.error(`Order Creation Transaction Failed: ${error.message}`);
      throw error;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  async finalizeCouponUsage(couponCode, session = null) {
    if (!couponCode) return;
    try {
      const code = couponCode.toUpperCase().trim();
      const options = session ? { session } : {};
      
      // Try to update Coupon first
      const couponUpdate = await Coupon.updateOne(
        { code, isDeleted: { $ne: true }, $or: [{ usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
        { $inc: { usedCount: 1 } },
        options
      );

      // If not a coupon, try to update Offer
      if (couponUpdate.matchedCount === 0) {
        await Offer.updateOne(
          { couponCode: code, isActive: true, isDeleted: { $ne: true }, $or: [{ usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
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
