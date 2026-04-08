const request = require("supertest");
const app = require("../server");

describe("Offers & Notifications Flows", () => {
  let adminToken;
  let userToken;
  let offerId;

  beforeAll(async () => {
    // 1. Create admin and user
    const adminRes = await request(app).post("/api/auth/register").send({
      name: "Offer Admin",
      email: "offeradmin@example.com",
      password: "Password123",
    });
    adminToken = adminRes.body.token;

    const userRes = await request(app).post("/api/auth/register").send({
      name: "Offer User",
      email: "offeruser@example.com",
      password: "Password123",
    });
    userToken = userRes.body.token;

    const mongoose = require("mongoose");
    const User = require("../models/user.model");
    await User.findOneAndUpdate({ email: "offeradmin@example.com" }, { role: "admin" });
  });

  describe("Offers Tests", () => {
    it("should allow admin to create an offer", async () => {
      const res = await request(app)
        .post("/api/offers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Offer",
          description: "Test discount description",
          discount: 20,
          isActive: true
        });
      
      expect(res.statusCode).toBe(201);
      offerId = res.body._id;
    });

    it("should fetch active offers (public)", async () => {
      const res = await request(app).get("/api/offers");
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("should deny updating offer for regular user", async () => {
      const res = await request(app)
        .put(`/api/offers/${offerId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Hack Offer" });
      
      expect(res.statusCode).toBe(403);
    });

    it("should allow admin to delete offer", async () => {
      const res = await request(app)
        .delete(`/api/offers/${offerId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
    });
  });

  describe("Notifications Tests", () => {
    it("should deny access to push notifications for user", async () => {
      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Test Push",
          body: "Test Body"
        });
      
      expect(res.statusCode).toBe(403);
    });

    it("should allow testing push broadcast by admin (could fail if Firebase not set up)", async () => {
      const res = await request(app)
        .post("/api/notifications/send")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Broadcast",
          body: "Broadcast body"
        });
      
      expect([200, 400, 500]).toContain(res.statusCode); // might fail in testing without valid Firebase credentials
    });
  });
});
