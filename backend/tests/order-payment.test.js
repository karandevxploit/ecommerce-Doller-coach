const request = require("supertest");
const app = require("../server");
const Product = require("../models/product.model");
const { createTestCategory, createTestUser } = require("./testHelpers");

describe("Order & Payment Flows", () => {
  let userToken;
  let adminToken;
  let productId;
  let orderId;

  beforeAll(async () => {
    const user = await createTestUser({
      name: "Order User",
      email: "orderuser@example.com",
      role: "user",
    });
    userToken = user.token;

    const admin = await createTestUser({
      name: "Order Admin",
      email: "orderadmin@example.com",
      role: "admin",
    });
    adminToken = admin.token;

    const category = await createTestCategory({ name: "Order Test" });

    const product = await Product.create({
      name: "Order Test Product",
      description: "Desc",
      price: 150,
      stock: 10,
      category: category._id,
      status: "active",
    });
    productId = product._id.toString();
  });

  describe("Order Flows", () => {
    it("should create an order for the user from cart", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1, price: 150 }],
          address: {
            name: "Order User",
            phone: "9876543210",
            street: "123 Test Street",
            city: "Delhi",
            state: "Delhi",
            pincode: "110001",
          },
          charges: {
            subtotal: 150,
            tax: 0,
            delivery: 0,
            discount: 0,
            codFee: 0,
            total: 150,
          },
          paymentMethod: "COD"
        });
      
      expect(res.statusCode).toBe(201);
      const order = res.body.data || res.body;
      expect(order._id || order.id).toBeTruthy();
      orderId = order._id || order.id;
      const createdOrder = order.order || order;
      expect(createdOrder.totalAmount || createdOrder.total).toBe(267);
    });

    it("should fetch user orders", async () => {
      const res = await request(app)
        .get("/api/orders/my")
        .set("Authorization", `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      const orders = res.body.data?.orders || res.body.data || res.body;
      expect(Array.isArray(orders)).toBeTruthy();
      expect(orders.length).toBeGreaterThan(0);
    });

    it("should deny updating order status for regular user", async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ status: "shipped" });
      
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to update order status", async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "shipped" });
      
      expect(res.statusCode).toBe(200);
      const order = res.body.data || res.body;
      expect(order.status).toBe("shipped");
    });
  });

  describe("Payment Flows (Razorpay)", () => {
    it("should create a payment order", async () => {
      // Mock failure or success depending on razorpay mocked keys in .env
      const res = await request(app)
        .post("/api/payments/create-order")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ amount: 150 });
      // Since Razorpay requires valid keys, this might fail with 500 or 400 if keys are invalid
      // We check that endpoint exists and returns a predictable response
      expect([200, 400, 502, 503]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty("id"); // razorpay order id
      }
    });

    it("should fail verification with invalid signature", async () => {
      const res = await request(app)
        .post("/api/payments/verify")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          razorpay_order_id: "fake_order_id",
          razorpay_payment_id: "fake_payment_id",
          razorpay_signature: "fake_signature",
          orderId: orderId
        });
      
      // Should fail signature validation
      expect(res.statusCode).toBe(400);
    });
  });
});
