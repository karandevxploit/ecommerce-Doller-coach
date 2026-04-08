const request = require("supertest");
const app = require("../server");

describe("Authentication & User Flows", () => {
  let userToken;

  const validUser = {
    name: "Test User",
    email: "test@example.com",
    password: "Password123",
  };

  const weakUser = {
    name: "Weak",
    email: "weak@example.com",
    password: "123",
  };

  const invalidEmailUser = {
    name: "Invalid",
    email: "not-an-email",
    password: "Password123",
  };

  describe("1. Registration Tests", () => {
    it("should reject weak password registration", async () => {
      const res = await request(app).post("/api/auth/register").send(weakUser);
      expect(res.statusCode).not.toBe(201); // Likely 400
    });

    it("should reject invalid email format", async () => {
      const res = await request(app).post("/api/auth/register").send(invalidEmailUser);
      expect(res.statusCode).not.toBe(201);
    });

    it("should register a valid user", async () => {
      const res = await request(app).post("/api/auth/register").send(validUser);
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("token");
    });

    it("should fail duplicate email registration", async () => {
      const res = await request(app).post("/api/auth/register").send(validUser);
      expect(res.statusCode).toBe(400); // 400 or 409
    });
  });

  describe("2. Login Tests", () => {
    it("should fail login for non-existing user", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "Password123",
      });
      expect(res.statusCode).not.toBe(200);
    });

    it("should fail login with wrong password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: "WrongPassword123",
      });
      expect(res.statusCode).not.toBe(200);
    });

    it("should login with correct credentials & generate JWT", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: validUser.password,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");
      userToken = res.body.token; // Save token for protected routes
    });
  });

  describe("3. Protected Route & JWT Tests", () => {
    it("should deny access without token", async () => {
      const res = await request(app).get("/api/user/profile");
      expect(res.statusCode).toBe(401);
    });

    it("should deny access with invalid/expired token", async () => {
      const res = await request(app)
        .get("/api/user/profile")
        .set("Authorization", `Bearer invalid.jwt.token`);
      expect(res.statusCode).toBe(401);
    });

    it("should allow access with valid token", async () => {
      const res = await request(app)
        .get("/api/user/profile")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.email).toBe(validUser.email);
    });
  });
});
