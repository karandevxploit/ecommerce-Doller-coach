// services/emailQueue.service.js

const { Queue } = require("bullmq");
const redis = require("../config/redis").rawClient;

const emailQueue = new Queue("email-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

/**
 * EMAIL TEMPLATES & HELPERS
 */
const sendOrderPlacedEmails = async ({ order, customer }) => {
  await emailQueue.add("order-confirmation", { order, customer });
};

const sendFulfillmentFailureEmail = async (order, reason) => {
  await emailQueue.add("admin-alert", { 
    subject: "Fulfillment Failure", 
    orderId: order._id, 
    reason 
  });
};

module.exports = { 
  emailQueue,
  sendOrderPlacedEmails,
  sendFulfillmentFailureEmail
};