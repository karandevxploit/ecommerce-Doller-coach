const request = require("supertest");
const app = require("../server");
const mongoose = require("mongoose");
const User = require("../models/user.model");

describe("Product Flows", () => {
  let userToken;
  let adminToken;
  let productId;

  beforeAll(async () => {
    // Register a normal user
    const userRes = await request(app).post("/api/auth/register").send({
      name: "Normal User",
      email: "user@example.com",
      password: "Password123",
    });
    userToken = userRes.body.token;

    // Register an admin user
    const adminRes = await request(app).post("/api/auth/register").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "Password123",
    });
    adminToken = adminRes.body.token;
    
    // Make the admin user an actual admin
    await User.findOneAndUpdate({ email: "admin@example.com" }, { role: "admin" });
  });

  describe("Product creation & Access Rules", () => {
    const newProduct = {
      name: "Test Product",
      description: "Test description",
      price: 100,
      stock: 50,
      category: "Electronics",
    };

    it("should deny product creation without token", async () => {
      const res = await request(app).post("/api/products").send(newProduct);
      expect(res.statusCode).toBe(401);
    });

    it("should deny product creation for regular user", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${userToken}`)
        .send(newProduct);
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to create a product", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Test Product")
        .field("description", "Test description")
        .field("price", 100)
        .field("stock", 50)
        .field("category", "Electronics");
        
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("name", "Test Product");
      productId = res.body._id;
    });
  });

  describe("Fetching Products", () => {
    it("should fetch all products without auth", async () => {
      const res = await request(app).get("/api/products");
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.products || res.body)).toBeTruthy();
    });

    it("should fetch a single product", async () => {
      const res = await request(app).get(`/api/products/${productId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("_id", productId);
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
        .field("price", 200);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("price", 200);
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
