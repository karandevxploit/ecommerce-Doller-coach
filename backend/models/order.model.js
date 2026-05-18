const crypto = require("crypto");
const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

const Order = createMysqlDocumentModel("Order", {
  statics: {
    async create(data) {
      const rows = Array.isArray(data) ? data : [data];
      const prepared = rows.map((order) => ({
        ...order,
        invoiceNumber: order.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(6).toString("hex")}`,
        statusHistory: order.statusHistory || [{ status: order.status || "placed", changedAt: new Date().toISOString() }],
      }));
      const created = [];
      for (const item of prepared) created.push(new this(await this._savePlain(item)));
      return Array.isArray(data) ? created : created[0];
    },
    markAsPaid({ orderId, paymentId, signature }) {
      return this.findOneAndUpdate(
        { _id: orderId, "payment.razorpayPaymentId": null },
        {
          $set: {
            paymentStatus: "PAID",
            "payment.razorpayPaymentId": paymentId,
            "payment.razorpaySignature": signature,
            isPaid: true,
            isLocked: true,
            paidAt: new Date().toISOString(),
          },
        },
        { new: true }
      );
    },
  },
});

module.exports = Order;
