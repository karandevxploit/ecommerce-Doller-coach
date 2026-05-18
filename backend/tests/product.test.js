const request = require("supertest");
const app = require("../server");
const mongoose = require("mongoose");
const { createTestCategory, createTestUser } = require("./testHelpers");

describe("Product Flows", () => {
  let userToken;
  let adminToken;
  let productId;
  let categoryId;

  beforeAll(async () => {
    const category = await createTestCategory({ name: "Electronics" });
    categoryId = String(category._id);

    const user = await createTestUser({
      name: "Normal User",
      email: "user@example.com",
      role: "user",
    });
    userToken = user.token;

    const admin = await createTestUser({
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    });
    adminToken = admin.token;
  });

  describe("Product creation & Access Rules", () => {
    const newProduct = {
      name: "Test Product",
      description: "Test description",
      price: 100,
      stock: 50,
      category: "",
    };

    it("should deny product creation without token", async () => {
      const res = await request(app).post("/api/products").send({ ...newProduct, category: categoryId });
      expect(res.statusCode).toBe(401);
    });

    it("should deny product creation for regular user", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ ...newProduct, category: categoryId });
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to create a product", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...newProduct, category: categoryId, status: "active" });
        
      expect(res.statusCode).toBe(201);
      const product = res.body.data || res.body;
      expect(product).toHaveProperty("name", "Test Product");
      productId = product._id || product.id;
    });
  });

  describe("Fetching Products", () => {
    it("should fetch all products without auth", async () => {
      const res = await request(app).get("/api/products");
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data?.products || res.body.products || res.body.data || res.body)).toBeTruthy();
    });

    it("should fetch a single product", async () => {
      const res = await request(app).get(`/api/products/${productId}`);
      expect(res.statusCode).toBe(200);
      const product = res.body.data || res.body;
      expect(product._id || product.id).toBe(productId);
    });

    it("should return 404 for invalid product id", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/products/${fakeId}`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("Updating and Deleting Products", () => {
    it("should deny update for regular user", async () => {
      const res = await request(app)
        .put(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ price: 200 });
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to update a product", async () => {
      const res = await request(app)
        .put(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ price: 200 });
      expect(res.statusCode).toBe(200);
      const product = res.body.data || res.body;
      expect(Number(product.price)).toBe(200);
    });

    it("should allow admin to delete a product", async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });

    it("should return 404 for fetching deleted product", async () => {
      const res = await request(app).get(`/api/products/${productId}`);
      expect(res.statusCode).toBe(404);
    });
  });
});
