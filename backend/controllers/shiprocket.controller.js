const asyncHandler = require("express-async-handler");
const Order = require("../models/order.model");
const { logger } = require("../utils/logger");

/**
 * SHIPROCKET WEBHOOK CONTROLLER
 * 
 * Events:
 * - SHIPPED
 * - IN_TRANSIT
 * - OUT_FOR_DELIVERY
 * - DELIVERED
 */
exports.handleWebhook = asyncHandler(async (req, res) => {
  const payload = req.body;
  
  // 1. Log incoming for trace
  logger.info("[SHIPROCKET_WEBHOOK]", { 
    awb: payload.awb,
    status: payload.current_status,
    orderId: payload.order_id 
  });

  const { awb, current_status, order_id } = payload;

  if (!awb || !current_status) {
    return res.status(400).send("Invalid Payload");
  }

  // 2. Map Shiprocket Status to Internal Status
  let internalStatus = null;
  const s = String(current_status).toUpperCase();

  if (s === "SHIPPED") internalStatus = "shipped";
  if (s === "DELIVERED") internalStatus = "delivered";
  if (s === "CANCELLED") internalStatus = "cancelled";

  // 3. Find and Update Order
  const order = await Order.findOne({ "shiprocket.awbCode": awb });
  
  if (!order) {
    logger.warn(`Webhook received for unknown AWB: ${awb}`);
    return res.status(200).send("Order not found, but acknowledged");
  }

  // 4. Update Status and History
  if (internalStatus) {
    order.status = internalStatus;
  }
  
  order.shiprocket.status = s;
  
  // Real-time tracking log
  order.statusHistory.push({
    status: `Shiprocket: ${s}`,
    changedAt: new Date()
  });

  await order.save();

  // 5. Notify User on Significant Status Changes
  if (s === "SHIFTED" || s === "DELIVERED") {
    // require("../services/notification.service").sendOrderUpdate(order);
  }

  return res.status(200).json({ success: true });
});
