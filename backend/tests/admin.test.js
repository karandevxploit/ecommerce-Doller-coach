const request = require("supertest");
const app = require("../server");

describe("Admin Dashboard & Security Tests", () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    // 1. Create admin and user
    const adminRes = await request(app).post("/api/auth/register").send({
      name: "Super Admin",
      email: "superadmin@example.com",
      password: "Password123",
    });
    adminToken = adminRes.body.token;

    const userRes = await request(app).post("/api/auth/register").send({
      name: "Hacker User",
      email: "hacker@example.com",
      password: "Password123",
    });
    userToken = userRes.body.token;

    const mongoose = require("mongoose");
    const User = require("../models/user.model");
    await User.findOneAndUpdate({ email: "superadmin@example.com" }, { role: "admin" });
  });

  describe("Admin Dashboard Tests", () => {
    it("should deny regular user access to admin stats", async () => {
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to fetch stats", async () => {
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalUsers");
      expect(res.body).toHaveProperty("totalProducts");
      expect(res.body).toHaveProperty("totalOrders");
      expect(res.body).toHaveProperty("totalRevenue");
    });
  });

  describe("Security Tests", () => {
    it("should not allow role tampering during registration", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Role Hacker",
        email: "rolehacker@example.com",
        password: "Password123",
        role: "admin" // Attempt to inject admin role
      });
      // the registration should succeed but role must be "user"
      expect(res.statusCode).toBe(201);
      
      const User = require("../models/user.model");
      const savedUser = await User.findOne({ email: "rolehacker@example.com" });
      expect(savedUser.role).not.toBe("admin");
      expect(savedUser.role).toBe("user");
    });

    it("should handle MongoDB injection attempts gracefully", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: { "$gt": "" }, // NoSQL injection
        password: "Password123"
      });
      // Express with proper handling/validation or Mongoose strict mode should reject or just return 400/404/401
      expect(res.statusCode).not.toBe(200);
    });
  });
});
