const axios = require("axios");
const { logger } = require("../utils/logger");
const { safeCall } = require("../config/redis");
const Order = require("../models/order.model");

/**
 * SHIPROCKET AUTOMATION SERVICE
 * 
 * Flow:
 * 1. Auth (Token caching in Redis)
 * 2. Create Adhoc Order
 * 3. Assign AWB
 * 4. Generate Pickup
 */

const SHIPROCKET_URL = "https://apiv2.shiprocket.in/v1/external";

class ShiprocketService {
  constructor() {
    this.email = process.env.SHIPROCKET_EMAIL;
    this.password = process.env.SHIPROCKET_PASSWORD;
  }

  /**
   * AUTH: Get dynamic token (cached 24h)
   */
  async getToken() {
    const cacheKey = "shiprocket:token";
    
    // 1. Try cache
    const cached = await safeCall(r => r.get(cacheKey));
    if (cached) return cached;

    // 2. Login
    try {
      logger.info("Authenticating with Shiprocket...");
      const res = await axios.post(`${SHIPROCKET_URL}/auth/login`, {
        email: this.email,
        password: this.password
      });

      const token = res.data.token;
      if (!token) throw new Error("Shiprocket Login Failed: No Token");

      // 3. Store in Redis (Expire in 23 hours to be safe)
      await safeCall(r => r.set(cacheKey, token, "EX", 82800));
      return token;
    } catch (err) {
      logger.error("SHIPROCKET_AUTH_ERROR", err.response?.data || err.message);
      throw new Error(`Shiprocket Auth Fail: ${err.message}`);
    }
  }

  /**
   * HELPERS: Create axios instance with auth
   */
  async getClient() {
    const token = await this.getToken();
    return axios.create({
      baseURL: SHIPROCKET_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
  }

  /**
   * STEP 1: CREATE ADHOC ORDER
   */
  async createAdhocOrder(order) {
    const client = await this.getClient();

    const payload = {
      order_id: order.invoiceNumber,
      order_date: order.createdAt.toISOString().slice(0, 10),
      pickup_location: "Primary", // Must match Shiprocket dashboard setting
      billing_customer_name: order.shippingAddress.fullName || "Customer",
      billing_last_name: "",
      billing_address: order.shippingAddress.addressLine1,
      billing_address_2: order.shippingAddress.addressLine2 || "",
      billing_city: order.shippingAddress.city,
      billing_pincode: order.shippingAddress.pincode,
      billing_state: order.shippingAddress.state,
      billing_country: "India",
      billing_email: "customer@example.com", // Fallback
      billing_phone: order.shippingAddress.phone,
      shipping_is_billing: true,
      order_items: order.products.map(p => ({
        name: p.title,
        sku: p.sku || p.productId,
        units: p.quantity,
        selling_price: p.price,
        discount: 0,
        tax: 0,
        hsn: 0
      })),
      payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
      sub_total: order.subtotal,
      length: 10, // Dim in cm (Fallback)
      breadth: 10,
      height: 10,
      weight: 0.5 // Weight in kg (Fallback)
    };

    try {
      const res = await client.post("/orders/create/adhoc", payload);
      logger.info("SHIPROCKET_ORDER_CREATED", { sr_id: res.data.order_id });
      return res.data;
    } catch (err) {
      logger.error("SHIPROCKET_CREATE_ORDER_ERROR", err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * STEP 2: ASSIGN AWB
   */
  async assignAWB(shipmentId) {
    const client = await this.getClient();
    try {
      const res = await client.post("/courier/assign/awb", {
        shipment_id: shipmentId
      });
      return res.data.response.data;
    } catch (err) {
      logger.error("SHIPROCKET_AWB_ERROR", err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * STEP 3: GENERATE PICKUP
   */
  async generatePickup(shipmentId) {
    const client = await this.getClient();
    try {
      const res = await client.post("/courier/generate/pickup", {
        shipment_id: [shipmentId]
      });
      return res.data;
    } catch (err) {
      logger.warn("SHIPROCKET_PICKUP_WARN", err.response?.data || err.message);
      return null; // Pickup might fail if already requested
    }
  }

  /**
   * MASTER FLOW: FULL FULFILLMENT
   * With 3 retries as requested.
   */
  async processOrder(orderId, attempt = 1) {
    const order = await Order.findById(orderId);
    if (!order) return;

    try {
      logger.info(`Fulfilling order ${orderId} (Attempt ${attempt})...`);

      // 1. Create order
      const srRes = await this.createAdhocOrder(order);
      const shiprocketOrderId = srRes.order_id;
      const shipmentId = srRes.shipment_id;

      // 2. Assign AWB
      const awbData = await this.assignAWB(shipmentId);

      // 3. Request Pickup
      await this.generatePickup(shipmentId);

      // 4. Update Database
      order.shiprocket = {
        orderId: String(shiprocketOrderId),
        shipmentId: String(shipmentId),
        awbCode: awbData.awb_code,
        courierName: awbData.courier_name,
        trackingUrl: `https://shiprocket.co/tracking/${awbData.awb_code}`,
        status: "SYNCED"
      };

      await order.save();
      logger.info(`✅ Order ${orderId} synced to Shiprocket successfully.`);

    } catch (err) {
      logger.error(`❌ Fulfillment Fail (Attempt ${attempt}): ${err.message}`);

      if (attempt < 3) {
        const delay = attempt * 5000;
        setTimeout(() => this.processOrder(orderId, attempt + 1), delay);
      } else {
        // PERMANENT FAIL
        order.shiprocket.status = "FAILED";
        order.shiprocket.error = err.message;
        await order.save();

        // Notify Admin
        require("./email.service").sendFulfillmentFailureEmail(order, err.message)
          .catch(e => logger.error("FAIL_EMAIL_FAIL", e));
      }
    }
  }
}

module.exports = new ShiprocketService();
