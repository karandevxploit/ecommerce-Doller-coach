// services/email.service.js
const { emailQueue } = require("./queue.service");

/**
 * EMAIL QUEUE HELPERS
 * These functions add tasks to the background worker to prevent blocking API responses.
 */

const sendOrderPlacedEmails = async ({ orderId, customerId }) => {
  await emailQueue.add("order-confirmation", { orderId, customerId });
};

const sendOrderStatusEmail = async ({ orderId, customerId }) => {
  await emailQueue.add("order-status-update", { orderId, customerId });
};

const sendFulfillmentFailureEmail = async (orderId, reason) => {
  await emailQueue.add("send-email", { 
    to: process.env.ADMIN_EMAIL || "admin@dollercoach.com",
    subject: "Fulfillment Failure Alert", 
    html: `<h3>Fulfillment Failed</h3><p>Order: ${orderId}</p><p>Reason: ${reason}</p>`
  });
};

module.exports = { 
  sendOrderPlacedEmails,
  sendOrderStatusEmail,
  sendFulfillmentFailureEmail
};