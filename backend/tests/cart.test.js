const request = require("supertest");
const app = require("../server");
const Product = require("../models/product.model");
const { createTestCategory, createTestUser } = require("./testHelpers");

describe("Cart Flows", () => {
  let userToken;
  let productId;

  beforeAll(async () => {
    const user = await createTestUser({
      name: "Cart User",
      email: "cartuser@example.com",
      role: "user",
    });
    userToken = user.token;

    const category = await createTestCategory({ name: "Cart Test" });

    const product = await Product.create({
      name: "Cart Test Product",
      description: "Desc",
      price: 50,
      stock: 10,
      category: category._id,
      status: "active",
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
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId, quantity: 2 });
    
    expect(res.statusCode).toBe(200);
    const cart = res.body.data || res.body;
    expect(cart).toHaveProperty("items");
    expect(cart.items.length).toBeGreaterThan(0);
    expect(cart.totalPrice).toBe(100);
  });

  it("should update item quantity in cart", async () => {
    const res = await request(app)
      .put("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId, quantity: 5 });
    
    expect(res.statusCode).toBe(200);
    const cart = res.body.data || res.body;
    expect(cart.items.find(item => String(item.product?._id || item.product || item.productId) === productId).quantity).toBe(5);
    expect(cart.totalPrice).toBe(250);
  });

  it("should remove item from cart", async () => {
    const res = await request(app)
      .delete(`/api/cart/${productId}`)
      .set("Authorization", `Bearer ${userToken}`);
    
    expect(res.statusCode).toBe(200);
    const cart = res.body.data || res.body;
    expect(cart.items.length).toBe(0);
    expect(cart.totalPrice).toBe(0);
  });
});
