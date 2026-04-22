const mongoose = require("mongoose");
const crypto = require("crypto");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE ORDER SCHEMA
 *
 * Features:
 * - Strong invoice uniqueness
 * - Idempotent payment handling
 * - Financial integrity enforcement
 * - Order immutability after payment
 * - Geo indexing
 * - Status tracking
 */

const productSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },

    size: { type: String, default: "" },
    topSize: { type: String, default: "" },
    bottomSize: { type: String, default: "" },
    color: { type: String, default: "" },

    /**
     * Snapshot fields (CRITICAL)
     */
    image: { type: String, default: "" },
    sku: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    products: [productSchema],

    subtotal: { type: Number, default: 0, min: 0 },
    delivery: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 18, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },

    total: { type: Number, required: true, min: 0 },

    /**
     * Strong unique invoice
     */
    invoiceNumber: {
      type: String,
      unique: true,
      index: true,
    },

    invoiceUrl: { type: String, default: "" },
    invoicePublicId: { type: String, default: "" },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
    },

    payment: {
      razorpayOrderId: { type: String, default: null, index: true },
      razorpayPaymentId: { type: String, default: null, unique: true, sparse: true },
      razorpaySignature: { type: String, default: null },

      /**
       * Idempotency key
       */
      idempotencyKey: { type: String, index: true },
    },

    status: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled"],
      default: "placed",
      index: true,
    },

    /**
     * Status history tracking
     */
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
      },
    ],

    shippingAddress: {
      fullName: { type: String, default: "" },
      phone: { type: String, required: true },
      addressLine1: { type: String, default: "" },
      addressLine2: { type: String, default: "" },
      landmark: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },

    /**
     * GeoJSON (for delivery optimization)
     */
    shippingLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },

    isPaid: { type: Boolean, default: false, index: true },
    paidAt: { type: Date, default: null },

    couponCode: { type: String, default: null, index: true },

    isLocked: {
      type: Boolean,
      default: false, // becomes true after payment
      index: true,
    },

    /**
     * SHIPROCKET AUTOMATION (NEW)
     */
    shiprocket: {
      orderId: { type: String, default: null, index: true },
      shipmentId: { type: String, default: null, index: true },
      awbCode: { type: String, default: null, index: true },
      courierName: { type: String, default: null },
      trackingUrl: { type: String, default: null },
      labelUrl: { type: String, default: null },
      manifestUrl: { type: String, default: null },
      status: { type: String, default: "NOT_SYNCED" }, // NOT_SYNCED, SYNCED, SHIPPED, DELIVERED, FAILED
      error: { type: String, default: null }, // To store last failure reason
    },
  },
  { timestamps: true }
);

/**
 * INDEXES
 */
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ "products.productId": 1 });
orderSchema.index({ isPaid: 1, total: 1 });
orderSchema.index({ shippingLocation: "2dsphere" });

/**
 * PRE-SAVE HOOK
 */
orderSchema.pre("save", function (next) {
  try {
    // Strong invoice generation
    if (!this.invoiceNumber) {
      const unique = crypto.randomBytes(6).toString("hex");
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      this.invoiceNumber = `INV-${date}-${unique}`;
    }

    // Financial integrity check
    const expectedTotal =
      this.subtotal + this.delivery + this.gst - this.discount;

    if (Math.abs(expectedTotal - this.total) > 1) {
      return next(new Error("Financial mismatch detected"));
    }

    // Payment sync
    if (this.paymentStatus === "PAID") {
      this.isPaid = true;
      this.isLocked = true;
      if (!this.paidAt) this.paidAt = new Date();
    }

    // Status history
    if (this.isModified("status")) {
      this.statusHistory.push({ status: this.status });
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * APPLY PAGINATION
 */
orderSchema.plugin(mongoosePaginate);

/**
 * STATIC: Idempotent Payment Update
 */
orderSchema.statics.markAsPaid = async function ({
  orderId,
  paymentId,
  signature,
}) {
  return this.findOneAndUpdate(
    {
      _id: orderId,
      "payment.razorpayPaymentId": null,
    },
    {
      $set: {
        paymentStatus: "PAID",
        "payment.razorpayPaymentId": paymentId,
        "payment.razorpaySignature": signature,
        isPaid: true,
        isLocked: true,
        paidAt: new Date(),
      },
    },
    { new: true }
  );
};

module.exports =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);