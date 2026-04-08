const request = require("supertest");
const app = require("../server");
const Product = require("../models/product.model");

describe("Cart Flows", () => {
  let userToken;
  let adminToken;
  let productId;

  beforeAll(async () => {
    // 1. Create users
    const userRes = await request(app).post("/api/auth/register").send({
      name: "Cart User",
      email: "cartuser@example.com",
      password: "Password123",
    });
    userToken = userRes.body.token;

    const adminRes = await request(app).post("/api/auth/register").send({
      name: "Cart Admin",
      email: "cartadmin@example.com",
      password: "Password123",
    });
    adminToken = adminRes.body.token;

    // 2. Make admin real admin
    const mongoose = require("mongoose");
    const User = require("../models/user.model");
    await User.findOneAndUpdate({ email: "cartadmin@example.com" }, { role: "admin" });

    // 3. Create a product
    const product = await Product.create({
      name: "Cart Test Product",
      description: "Desc",
      price: 50,
      stock: 10,
      category: "Test",
    });
    productId = product._id.toString();
  });

  it("should fetch an empty cart initially", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.statusCode).toBe(200);
    // Might return an empty object or { items: [], totalPrice: 0 } depending on implementation
    if (res.body && res.body.items) {
      expect(res.body.items.length).toBe(0);
    }
  });

  it("should add item to cart", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId, quantity: 2 });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.totalPrice).toBe(100);
  });

  it("should update item quantity in cart", async () => {
    const res = await request(app)
      .put("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId, quantity: 5 });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.items.find(item => item.product._id.toString() === productId || item.product.toString() === productId).quantity).toBe(5);
    expect(res.body.totalPrice).toBe(250);
  });

  it("should remove item from cart", async () => {
    const res = await request(app)
      .delete(`/api/cart/${productId}`)
      .set("Authorization", `Bearer ${userToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(0);
    expect(res.body.totalPrice).toBe(0);
  });
});
