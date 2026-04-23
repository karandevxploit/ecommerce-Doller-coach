const mongoose = require("mongoose");
const crypto = require("crypto");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE ORDER SCHEMA
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
    image: { type: String, default: "" },
    sku: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Index moved
    products: [productSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    delivery: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 18, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    invoiceNumber: { type: String, unique: true }, // unique implies index
    invoiceUrl: { type: String, default: "" },
    invoicePublicId: { type: String, default: "" },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
    },
    payment: {
      razorpayOrderId: { type: String, default: null },
      razorpayPaymentId: { type: String, default: null, unique: true, sparse: true },
      razorpaySignature: { type: String, default: null },
      idempotencyKey: { type: String },
    },
    status: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
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
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    couponCode: { type: String, default: null },
    isLocked: {
      type: Boolean,
      default: false,
    },
    shiprocket: {
      orderId: { type: String, default: null },
      shipmentId: { type: String, default: null },
      awbCode: { type: String, default: null },
      courierName: { type: String, default: null },
      trackingUrl: { type: String, default: null },
      labelUrl: { type: String, default: null },
      manifestUrl: { type: String, default: null },
      status: { type: String, default: "NOT_SYNCED" },
      error: { type: String, default: null },
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ "products.productId": 1 });
orderSchema.index({ isPaid: 1, total: 1 });
orderSchema.index({ shippingLocation: "2dsphere" });
// orderSchema.index({ invoiceNumber: 1 }); // Duplicated by unique: true in definition
orderSchema.index({ "payment.razorpayOrderId": 1 });
orderSchema.index({ "payment.idempotencyKey": 1 });
orderSchema.index({ couponCode: 1 });
orderSchema.index({ isLocked: 1 });
orderSchema.index({ "shiprocket.orderId": 1 });
orderSchema.index({ "shiprocket.shipmentId": 1 });
orderSchema.index({ "shiprocket.awbCode": 1 });

/**
 * PRE-SAVE HOOK
 */
orderSchema.pre("save", function (next) {
  try {
    if (!this.invoiceNumber) {
      const unique = crypto.randomBytes(6).toString("hex");
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      this.invoiceNumber = `INV-${date}-${unique}`;
    }

    const expectedTotal =
      this.subtotal + this.delivery + this.gst - this.discount;

    if (Math.abs(expectedTotal - this.total) > 1) {
      return next(new Error("Financial mismatch detected"));
    }

    if (this.paymentStatus === "PAID") {
      this.isPaid = true;
      this.isLocked = true;
      if (!this.paidAt) this.paidAt = new Date();
    }

    if (this.isModified("status")) {
      this.statusHistory.push({ status: this.status });
    }

    next();
  } catch (err) {
    next(err);
  }
});

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