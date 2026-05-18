const axios = require("axios");
const env = require("../config/env");
const { logger } = require("../utils/logger");
const { safeCall } = require("../config/redis");
const Order = require("../models/order.model");
const { sendEmail } = require("../utils/sendEmail");

class ShiprocketService {
  constructor() {
    this.email = env.SHIPROCKET_EMAIL;
    this.password = env.SHIPROCKET_PASSWORD;
    this.baseURL = env.SHIPROCKET_API_URL;
    this.tokenKey = "shiprocket:auth:token:v1";
  }

  hasCredentials() {
    return Boolean(this.email && this.password && this.baseURL);
  }

  buildError(message, statusCode = 502, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.details = details;
    return err;
  }

  safeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1971) return null;
    return date.toISOString();
  }

  firstNonEmpty(...values) {
    return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || null;
  }

  sanitizePayload(payload = {}) {
    return {
      ...payload,
      billing_phone: payload.billing_phone ? "**********" : "",
      billing_email: payload.billing_email ? "masked@example.com" : "",
    };
  }

  // 1. authenticate()
  async authenticate(forceRefresh = false) {
    if (!this.hasCredentials()) {
      throw this.buildError("Shiprocket credentials are not configured", 503);
    }

    if (!forceRefresh) {
      const cachedToken = await safeCall((r) => r.get(this.tokenKey));
      if (cachedToken) return cachedToken;
    }

    try {
      const res = await axios.post(`${this.baseURL}/auth/login`, {
        email: this.email,
        password: this.password,
      }, { timeout: 10000 });

      const token = res?.data?.token;
      if (!token) throw new Error("Shiprocket did not return token");
      await safeCall((r) => r.set(this.tokenKey, token, "EX", 60 * 55));
      return token;
    } catch (err) {
      logger.error({
        error: err.message,
        response: err.response?.data,
      }, "SHIPROCKET_AUTH_FAILED");
      throw this.buildError("Shiprocket authentication failed", err.response?.status || 502, err.response?.data);
    }
  }

  async getClient(forceRefresh = false) {
    const token = await this.authenticate(forceRefresh);
    return axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  async requestWithAutoRefresh(config) {
    try {
      const client = await this.getClient(false);
      return await client.request(config);
    } catch (err) {
      if (err.response?.status === 401) {
        const client = await this.getClient(true);
        return client.request(config);
      }
      throw err;
    }
  }

  // 2. createOrder(orderData)
  async createOrder(orderData) {
    const payload = {
      order_id: String(orderData.invoiceNumber || orderData._id),
      order_date: new Date(orderData.createdAt || Date.now()).toISOString().slice(0, 10),
      pickup_location: "Primary",
      billing_customer_name: orderData.shippingAddress?.fullName || "Customer",
      billing_last_name: "",
      billing_address: orderData.shippingAddress?.addressLine1 || "",
      billing_address_2: orderData.shippingAddress?.addressLine2 || "",
      billing_city: orderData.shippingAddress?.city || "",
      billing_pincode: orderData.shippingAddress?.pincode || "",
      billing_state: orderData.shippingAddress?.state || "",
      billing_country: "India",
      billing_email: orderData.customerEmail || "customer@example.com",
      billing_phone: orderData.shippingAddress?.phone || "",
      shipping_is_billing: true,
      order_items: (orderData.products || []).map((p) => ({
        name: p.title,
        sku: p.sku || String(p.productId || "SKU"),
        units: Number(p.quantity || 1),
        selling_price: Number(p.price || 0),
        discount: 0,
        tax: 0,
        hsn: 0,
      })),
      payment_method: orderData.paymentMethod === "COD" ? "COD" : "Prepaid",
      sub_total: Number(orderData.subtotal || 0),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    logger.info({
      orderId: payload.order_id,
      payload: this.sanitizePayload(payload),
    }, "SHIPROCKET_CREATE_ORDER_PAYLOAD");

    try {
      const created = await this.requestWithAutoRefresh({
        method: "post",
        url: "/orders/create/adhoc",
        data: payload,
      });

      logger.info({
        orderId: payload.order_id,
        response: created?.data,
      }, "SHIPROCKET_CREATE_ORDER_RESPONSE");

      const shipmentId = this.firstNonEmpty(
        created?.data?.shipment_id,
        created?.data?.data?.shipment_id,
        created?.data?.response?.data?.shipment_id
      );
      const shiprocketOrderId = this.firstNonEmpty(
        created?.data?.order_id,
        created?.data?.data?.order_id,
        created?.data?.response?.data?.order_id,
        payload.order_id
      );

      if (!shipmentId) {
        throw this.buildError("Shiprocket shipment id missing", 502, created?.data);
      }

      const awbRes = await this.requestWithAutoRefresh({
        method: "post",
        url: "/courier/assign/awb",
        data: { shipment_id: shipmentId },
      });

      const awbData = awbRes?.data?.response?.data || {};
      logger.info({
        orderId: payload.order_id,
        shipmentId,
        response: awbRes?.data,
      }, "SHIPROCKET_ASSIGN_AWB_RESPONSE");

      const awbCode = this.firstNonEmpty(awbData.awb_code, awbData.awb, awbData.awbCode);
      if (!awbCode) {
        throw this.buildError("Shiprocket AWB assignment failed", 502, awbRes?.data);
      }

      await this.requestWithAutoRefresh({
        method: "post",
        url: "/courier/generate/pickup",
        data: { shipment_id: [shipmentId] },
      }).then((pickupRes) => {
        logger.info({
          orderId: payload.order_id,
          shipmentId,
          response: pickupRes?.data,
        }, "SHIPROCKET_PICKUP_RESPONSE");
      }).catch((pickupErr) => {
        logger.warn({
          orderId: payload.order_id,
          shipmentId,
          error: pickupErr.message,
          response: pickupErr.response?.data,
        }, "SHIPROCKET_PICKUP_FAILED_NON_BLOCKING");
      });

      return {
        order_id: String(shiprocketOrderId || payload.order_id),
        shipment_id: String(shipmentId),
        awb_code: awbCode,
        courier_name: this.firstNonEmpty(awbData.courier_name, awbData.courier_company_name),
        tracking_id: this.firstNonEmpty(awbData.tracking_id, awbData.awb_code, awbCode),
        tracking_url: `https://shiprocket.co/tracking/${awbCode}`,
        estimated_delivery: this.safeDate(this.firstNonEmpty(awbData.etd, awbData.edd, awbData.estimated_delivery_date)),
        current_status: this.firstNonEmpty(awbData.current_status, awbData.status, "BOOKED"),
        raw_response: {
          create: created?.data || null,
          awb: awbRes?.data || null,
        },
      };
    } catch (err) {
      logger.error({
        orderId: payload.order_id,
        error: err.message,
        details: err.details || null,
        response: err.response?.data,
      }, "SHIPROCKET_CREATE_ORDER_FAILED");
      throw this.buildError(err.message || "Shiprocket order creation failed", err.statusCode || err.response?.status || 502, err.details || err.response?.data);
    }
  }

  // 3. getTracking(shipment_id)
  async getTracking(shipmentId) {
    try {
      const res = await this.requestWithAutoRefresh({
        method: "get",
        url: `/courier/track/shipment/${shipmentId}`,
      });
      return res?.data || {};
    } catch (err) {
      logger.error({ shipmentId, error: err.message, response: err.response?.data }, "SHIPROCKET_TRACKING_FAILED");
      throw new Error("Shiprocket tracking fetch failed");
    }
  }

  mapShipmentStatus(srStatus = "") {
    const s = String(srStatus).toLowerCase();
    if (s.includes("fail") || s.includes("cancel") || s.includes("rto") || s.includes("return")) return "failed";
    if (s.includes("deliver")) return "delivered";
    if (s.includes("transit")) return "in_transit";
    if (s.includes("ship")) return "shipped";
    if (s.includes("book")) return "booked";
    return "pending";
  }

  buildFailureShipment(order, err) {
    const now = new Date().toISOString();
    const previousShipment = order?.shipment?.toObject?.() || order?.shipment || {};
    const previousShiprocket = order?.shiprocket?.toObject?.() || order?.shiprocket || {};
    return {
      shipment_status: "failed",
      shipment: {
        ...previousShipment,
        status: "failed",
        current_status: "FAILED",
        shipment_id: previousShipment.shipment_id || previousShiprocket.shipmentId || null,
        awb_code: previousShipment.awb_code || previousShiprocket.awbCode || null,
        courier_name: previousShipment.courier_name || previousShiprocket.courierName || null,
        tracking_id: previousShipment.tracking_id || null,
        tracking_url: previousShipment.tracking_url || previousShiprocket.trackingUrl || null,
        estimated_delivery: this.safeDate(previousShipment.estimated_delivery),
        last_error: err.message,
        error_details: err.details || err.response?.data || null,
        failed_at: now,
        last_updated_at: now,
      },
      shiprocket: {
        ...previousShiprocket,
        orderId: previousShiprocket.orderId || String(order?.invoiceNumber || order?._id || ""),
        status: "FAILED",
        error: err.message,
        errorDetails: err.details || err.response?.data || null,
        failedAt: now,
      },
    };
  }

  async bookShipmentForOrder(orderId) {
    const order = await Order.findById(orderId).populate("userId", "email name");
    if (!order) return null;
    if (order.shipment?.awb_code && order.shipment?.shipment_id) return order;

    try {
      const shipment = await this.createOrder({
        ...order.toObject(),
        customerEmail: order.userId?.email,
      });

      order.shipment_status = "booked";
      order.shipment = {
        shipment_id: shipment.shipment_id,
        awb_code: shipment.awb_code,
        courier_name: shipment.courier_name,
        tracking_id: shipment.tracking_id,
        tracking_url: shipment.tracking_url,
        estimated_delivery: shipment.estimated_delivery,
        current_status: shipment.current_status || "BOOKED",
        status: "booked",
        provider: "shiprocket",
        raw_response: shipment.raw_response || null,
        booked_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_error: null,
      };

      order.shiprocket = {
        orderId: shipment.order_id || String(order.invoiceNumber || order._id),
        shipmentId: shipment.shipment_id,
        awbCode: shipment.awb_code,
        courierName: shipment.courier_name,
        trackingId: shipment.tracking_id,
        trackingUrl: shipment.tracking_url,
        status: String(shipment.current_status || "BOOKED").toUpperCase(),
        error: null,
      };

      await order.save();
      logger.info({
        orderId: String(order._id),
        shipment: order.shipment,
      }, "SHIPROCKET_DB_BOOKING_SAVED");

      if (order.userId?.email) {
        await sendEmail({
          to: order.userId.email,
          subject: `Your shipment is booked for order #${String(order._id).slice(-6)}`,
          html: `<p>Your order has been shipped via <b>${shipment.courier_name || "Shiprocket Partner"}</b>.</p>
                 <p>Tracking link: <a href="${shipment.tracking_url || "#"}">${shipment.tracking_url || "Will be available soon"}</a></p>`,
        });
      }

      // Realtime removed (Step 3)

      return order;
    } catch (err) {
      const failure = this.buildFailureShipment(order, err);
      await Order.findByIdAndUpdate(orderId, { $set: failure });
      logger.error({
        orderId: String(orderId),
        failure,
      }, "SHIPROCKET_DB_FAILURE_SAVED");
      throw err;
    }
  }

  async syncTrackingStatus() {
    const active = await Order.find({
      "shipment.shipment_id": { $ne: null },
      shipment_status: { $in: ["booked", "shipped", "in_transit", "pending"] },
    }).limit(200);

    for (const order of active) {
      try {
        const tracking = await this.getTracking(order.shipment.shipment_id);
        const currentStatus =
          tracking?.tracking_data?.shipment_track?.[0]?.current_status ||
          tracking?.tracking_data?.shipment_track?.[0]?.shipment_status ||
          tracking?.current_status ||
          "pending";

        const nextStatus = this.mapShipmentStatus(currentStatus);
        const estimated = this.safeDate(tracking?.tracking_data?.etd);

        const prevStatus = order.shipment_status;
        order.shipment_status = nextStatus;
        order.shipment.last_updated_at = new Date().toISOString();
        order.shipment.current_status = currentStatus;
        order.shipment.estimated_delivery = estimated || this.safeDate(order.shipment.estimated_delivery);
        order.shipment.last_error = null;
        order.shiprocket.status = String(currentStatus).toUpperCase();
        order.shiprocket.trackingId = order.shipment.tracking_id || order.shiprocket.trackingId || order.shipment.awb_code || null;
        await order.save();

        if (prevStatus !== nextStatus) {
          const user = await require("../models/user.model").findById(order.userId).select("email").lean();
          if (user?.email) {
            await sendEmail({
              to: user.email,
              subject: `Shipment update for order #${String(order._id).slice(-6)}`,
              html: `<p>Your shipment status is now <b>${nextStatus.replace("_", " ")}</b>.</p>
                     <p>Track here: <a href="${order.shipment.tracking_url || "#"}">${order.shipment.tracking_url || "Tracking unavailable"}</a></p>`,
            });
          }
        }

        // Realtime removed (Step 4)
      } catch (err) {
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            shipment_status: "failed",
            "shipment.status": "failed",
            "shipment.current_status": "FAILED",
            "shipment.last_error": err.message,
            "shipment.last_updated_at": new Date().toISOString(),
            "shiprocket.status": "FAILED",
            "shiprocket.error": err.message,
          },
        });
      }
    }
  }
}

module.exports = new ShiprocketService();
