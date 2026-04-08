const BaseRepository = require("./base.repository");
const Order = require("../models/order.model");

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  async findByRazorpayOrderId(razorpayOrderId) {
    return await this.model.findOne({ "payment.razorpayOrderId": razorpayOrderId });
  }

  async updatePaymentInfo(orderId, paymentData) {
    return await this.model.findByIdAndUpdate(
      orderId,
      {
        $set: {
          "payment.razorpayPaymentId": paymentData.paymentId,
          "payment.razorpaySignature": paymentData.signature,
          paymentStatus: paymentData.status,
          status: paymentData.status === "PAID" ? "confirmed" : "placed",
          isPaid: paymentData.status === "PAID",
          paidAt: paymentData.status === "PAID" ? new Date() : null,
        },
      },
      { new: true }
    );
  }
}

module.exports = new OrderRepository();
