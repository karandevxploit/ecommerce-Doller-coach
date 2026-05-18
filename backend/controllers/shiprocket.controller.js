const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Order = require("../models/order.model");
const { ok, fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");

const clean = (value = "") => String(value ?? "").trim();

const pick = (obj, keys = []) => {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], obj);
    if (value !== undefined && value !== null && clean(value)) return clean(value);
  }
  return "";
};

const normalizeShiprocketStatus = (status = "") => {
  const raw = clean(status).toLowerCase().replace(/\s+/g, "_");

  if (!raw) return "";
  if (raw.includes("fail") || raw.includes("error")) return "failed";
  if (raw.includes("out_for_delivery") || raw.includes("ofd")) return "in_transit";
  if (raw.includes("deliver")) return "delivered";
  if (raw.includes("transit") || raw.includes("pickup") || raw.includes("manifest")) return "in_transit";
  if (raw.includes("ship") || raw.includes("assigned") || raw.includes("awb")) return "shipped";
  if (raw.includes("book") || raw.includes("new")) return "booked";
  if (raw.includes("cancel") || raw.includes("rto") || raw.includes("return")) return "failed";

  return "pending";
};

const isOutForDelivery = (status = "") => {
  const raw = clean(status).toLowerCase().replace(/\s+/g, "_");
  return raw.includes("out_for_delivery") || raw.includes("ofd");
};

const toOrderStatus = (shipmentStatus, currentOrderStatus, rawStatus = "") => {
  if (shipmentStatus === "delivered") return "delivered";
  if (isOutForDelivery(rawStatus)) return "out_for_delivery";
  if (shipmentStatus === "shipped" || shipmentStatus === "in_transit" || shipmentStatus === "booked") {
    return "shipped";
  }
  return currentOrderStatus;
};

const buildTrackingUrl = (awb, fallback = "") => {
  if (fallback) return fallback;
  return awb ? `https://shiprocket.co/tracking/${awb}` : "";
};

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getFullYear() <= 1971 ? null : date;
};

const resolveWebhook = (payload = {}) => {
  const root = payload.data || payload;
  const shipmentTrack = root.shipment_track?.[0] || root.shipmentTrack?.[0] || {};

  const awb = pick(root, [
    "awb",
    "awb_code",
    "awbCode",
    "awb_number",
    "tracking_number",
    "shipment.awb_code",
  ]) || pick(shipmentTrack, ["awb_code", "awb", "awbCode"]);

  const shipmentId = pick(root, [
    "shipment_id",
    "shipmentId",
    "shipment.shipment_id",
    "sr_shipment_id",
  ]) || pick(shipmentTrack, ["shipment_id", "shipmentId"]);

  const shiprocketOrderId = pick(root, [
    "order_id",
    "orderId",
    "channel_order_id",
    "shiprocket_order_id",
  ]) || pick(shipmentTrack, ["order_id", "orderId"]);

  const status = pick(root, [
    "current_status",
    "currentStatus",
    "shipment_status",
    "status",
    "event",
  ]) || pick(shipmentTrack, ["current_status", "shipment_status", "status"]);

  return {
    awb,
    shipmentId,
    shiprocketOrderId,
    status,
    courierName:
      pick(root, ["courier_name", "courierName", "courier_company_name"]) ||
      pick(shipmentTrack, ["courier_name", "courierName"]),
    trackingUrl: pick(root, ["tracking_url", "trackingUrl", "track_url"]),
    estimatedDelivery: pick(root, ["etd", "edd", "estimated_delivery", "expected_delivery_date"]),
    raw: root,
  };
};

const buildOrderQuery = ({ awb, shipmentId, shiprocketOrderId }) => {
  const ors = [];

  if (awb) {
    ors.push({ "shiprocket.awbCode": awb }, { "shipment.awb_code": awb });
  }

  if (shipmentId) {
    ors.push({ "shiprocket.shipmentId": shipmentId }, { "shipment.shipment_id": shipmentId });
  }

  if (shiprocketOrderId) {
    ors.push(
      { "shiprocket.orderId": shiprocketOrderId },
      { invoiceNumber: shiprocketOrderId }
    );

    if (mongoose.Types.ObjectId.isValid(shiprocketOrderId)) {
      ors.push({ _id: shiprocketOrderId });
    }
  }

  return ors.length ? { $or: ors } : null;
};

const pushHistoryOnce = (order, status, message) => {
  const last = order.statusHistory?.[order.statusHistory.length - 1];
  const lastStatus = clean(last?.status);

  if (lastStatus === message || lastStatus === status) return;

  order.statusHistory.push({
    status: message,
    changedAt: new Date(),
  });
};

// ===============================
// SHIPROCKET WEBHOOK
// ===============================
exports.handleWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  const providedSecret =
    req.get?.("x-shiprocket-secret") ||
    req.get?.("x-webhook-secret") ||
    req.query?.secret;

  if (webhookSecret && providedSecret !== webhookSecret) {
    return fail(res, "Invalid webhook signature", 401);
  }

  const resolved = resolveWebhook(req.body || {});
  const shipmentStatus = normalizeShiprocketStatus(resolved.status);

  logger.info("[SHIPROCKET_WEBHOOK]", {
    awb: resolved.awb || null,
    shipmentId: resolved.shipmentId || null,
    orderId: resolved.shiprocketOrderId || null,
    status: resolved.status || null,
  });

  if (!resolved.awb && !resolved.shipmentId && !resolved.shiprocketOrderId) {
    return fail(res, "Invalid Shiprocket payload", 400);
  }

  const query = buildOrderQuery(resolved);
  const order = query ? await Order.findOne(query) : null;

  if (!order) {
    logger.warn("[SHIPROCKET_WEBHOOK_UNKNOWN_ORDER]", {
      awb: resolved.awb || null,
      shipmentId: resolved.shipmentId || null,
      orderId: resolved.shiprocketOrderId || null,
    });
    return ok(res, { acknowledged: true, matched: false }, "Webhook acknowledged");
  }

  const now = new Date();
  const oldShipmentStatus = order.shipment_status;
  const nextOrderStatus = toOrderStatus(shipmentStatus, order.status, resolved.status);
  const rawStatus = clean(resolved.status).toUpperCase() || order.shiprocket?.status || "UPDATED";

  if (shipmentStatus && order.shipment_status !== shipmentStatus) {
    order.shipment_status = shipmentStatus;
  }

  if (nextOrderStatus && order.status !== nextOrderStatus) {
    order.status = nextOrderStatus;
  }

  order.shipment = {
    ...(order.shipment?.toObject?.() || order.shipment || {}),
    shipment_id: resolved.shipmentId || order.shipment?.shipment_id || order.shiprocket?.shipmentId || null,
    awb_code: resolved.awb || order.shipment?.awb_code || order.shiprocket?.awbCode || null,
    courier_name: resolved.courierName || order.shipment?.courier_name || order.shiprocket?.courierName || null,
    tracking_url: buildTrackingUrl(
      resolved.awb || order.shipment?.awb_code || order.shiprocket?.awbCode,
      resolved.trackingUrl || order.shipment?.tracking_url || order.shiprocket?.trackingUrl || ""
    ) || null,
    estimated_delivery: safeDate(resolved.estimatedDelivery) || order.shipment?.estimated_delivery || null,
    last_updated_at: now,
    last_error: null,
  };

  order.shiprocket = {
    ...(order.shiprocket?.toObject?.() || order.shiprocket || {}),
    orderId: resolved.shiprocketOrderId || order.shiprocket?.orderId || order.invoiceNumber || String(order._id),
    shipmentId: order.shipment.shipment_id,
    awbCode: order.shipment.awb_code,
    courierName: order.shipment.courier_name,
    trackingUrl: order.shipment.tracking_url,
    status: rawStatus,
    error: null,
  };

  if (oldShipmentStatus !== order.shipment_status || resolved.status) {
    pushHistoryOnce(order, order.status, `Shiprocket: ${rawStatus}`);
  }

  await order.save();

  return ok(
    res,
    {
      acknowledged: true,
      matched: true,
      orderId: order._id,
      shipmentStatus: order.shipment_status,
      status: order.status,
    },
    "Webhook processed"
  );
});
