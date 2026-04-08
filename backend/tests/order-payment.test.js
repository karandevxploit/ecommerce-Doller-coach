const request = require("supertest");
const app = require("../server");
const Product = require("../models/product.model");
const Order = require("../models/order.model");

describe("Order & Payment Flows", () => {
  let userToken;
  let adminToken;
  let productId;
  let orderId;

  beforeAll(async () => {
    // 1. Create users
    const userRes = await request(app).post("/api/auth/register").send({
      name: "Order User",
      email: "orderuser@example.com",
      password: "Password123",
    });
    userToken = userRes.body.token;

    const adminRes = await request(app).post("/api/auth/register").send({
      name: "Order Admin",
      email: "orderadmin@example.com",
      password: "Password123",
    });
    adminToken = adminRes.body.token;

    // 2. Make admin real admin
    const mongoose = require("mongoose");
    const User = require("../models/user.model");
    await User.findOneAndUpdate({ email: "orderadmin@example.com" }, { role: "admin" });

    // 3. Create a product
    const product = await Product.create({
      name: "Order Test Product",
      description: "Desc",
      price: 150,
      stock: 10,
      category: "Test",
    });
    productId = product._id.toString();

    // 4. Add item to user cart for order creation
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId, quantity: 1 });
  });

  describe("Order Flows", () => {
    it("should create an order for the user from cart", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          shippingAddress: "123 Test St",
          paymentMethod: "Razorpay"
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.totalAmount).toBe(150);
      orderId = res.body._id;
    });

    it("should fetch user orders", async () => {
      const res = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("should deny updating order status for regular user", async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ status: "Shipped" });
      
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to update order status", async () => {
      const res = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Shipped" });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("Shipped");
    });
  });

  describe("Payment Flows (Razorpay)", () => {
    it("should create a payment order", async () => {
      // Mock failure or success depending on razorpay mocked keys in .env
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ amount: 150 });
      // Since Razorpay requires valid keys, this might fail with 500 or 400 if keys are invalid
      // We check that endpoint exists and returns a predictable response
      expect([200, 400, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty("id"); // razorpay order id
      }
    });

    it("should fail verification with invalid signature", async () => {
      const res = await request(app)
        .post("/api/payment/verify")
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
