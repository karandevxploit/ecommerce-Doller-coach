const request = require("supertest");
const app = require("../server");
const { createTestUser } = require("./testHelpers");

describe("Admin Dashboard & Security Tests", () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    const admin = await createTestUser({
      name: "Super Admin",
      email: "superadmin@example.com",
      role: "admin",
    });
    adminToken = admin.token;

    const user = await createTestUser({
      name: "Hacker User",
      email: "hacker@example.com",
      role: "user",
    });
    userToken = user.token;
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
      const data = res.body.data || res.body;
      expect(data.totalUsers ?? data.customers).toBeDefined();
      expect(data.totalOrders ?? data.orders).toBeDefined();
      expect(data.totalRevenue ?? data.revenue).toBeDefined();
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
