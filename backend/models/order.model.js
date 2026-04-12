const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        title: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        size: { type: String, default: "" },
        topSize: { type: String, default: "" },
        bottomSize: { type: String, default: "" }
      }
    ],
    subtotal: { type: Number, default: 0, min: 0 },
    delivery: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 18, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    invoiceNumber: { type: String, unique: true, sparse: true, index: true },
    invoiceUrl: { type: String, default: "" },
    invoicePublicId: { type: String, default: "" },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING", index: true },
    paymentMethod: { type: String, enum: ["COD", "ONLINE"], default: "COD", index: true },
    payment: {
      razorpayOrderId: { type: String, default: null, index: true },
      razorpayPaymentId: { type: String, default: null, index: true },
      razorpaySignature: { type: String, default: null },
    },
    status: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled"],
      default: "placed",
      index: true
    },
    shippingAddress: {
      name: { type: String, default: "" },
      phone: { type: String, required: true },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" }
    },
    locationType: { type: String, enum: ["manual", "gps", "gps_manual"], default: "manual", index: true },
    shippingLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    isPaid: { type: Boolean, default: false, index: true },
    paidAt: { type: Date, default: null },
    couponCode: { type: String, default: null, index: true },
    discount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Generate unique invoice number before saving
orderSchema.pre("save", async function (next) {
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    this.invoiceNumber = `INV-${year}${month}-${random}`;
  }
  // Field Synchronization: Ensure 'total' is always the source of truth for analytics
  // This maps legacy fields (totalAmount, totalPrice) to 'total' if 'total' is missing
  if (!this.total) {
    this.total = this.totalAmount || this.totalPrice || 0;
  }
  
  // Sync isPaid with paymentStatus
  if (this.paymentStatus === "PAID") {
    this.isPaid = true;
    if (!this.paidAt) this.paidAt = new Date();
  }

  next();
});

const mongoosePaginate = require("mongoose-paginate-v2");

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, "products.productId": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.plugin(mongoosePaginate);

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);


