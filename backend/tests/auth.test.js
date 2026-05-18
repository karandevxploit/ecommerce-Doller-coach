const crypto = require("crypto");
const request = require("supertest");
const app = require("../server");
const Otp = require("../models/otp.model");
const User = require("../models/user.model");

const hashOtp = (code) => crypto.createHash("sha256").update(code).digest("hex");

const validUser = {
  name: "Test User",
  email: "test@example.com",
  phone: "9876543210",
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

beforeEach(async () => {
  const collections = require("mongoose").connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const registerAndVerify = async (overrides = {}) => {
  const user = { ...validUser, ...overrides };
  const otpCode = "123456";

  const registerRes = await request(app).post("/api/auth/register").send(user);
  expect(registerRes.statusCode).toBe(201);
  expect(registerRes.body.success).toBe(true);
  expect(registerRes.body.data?.requiresVerification).toBe(true);

  const dbUser = await User.findOne({ email: user.email.toLowerCase() }).lean();
  expect(dbUser).toBeTruthy();

  await Otp.updateOne(
    { userId: dbUser._id, channel: "signup", usedAt: null },
    { $set: { codeHash: hashOtp(otpCode), expiresAt: new Date(Date.now() + 600000) } }
  );

  const verifyRes = await request(app).post("/api/auth/verify-otp").send({
    email: user.email,
    otp: otpCode,
    purpose: "signup",
  });

  expect(verifyRes.statusCode).toBe(200);
  expect(verifyRes.body.token || verifyRes.body.accessToken || verifyRes.body.data?.token).toBeTruthy();

  return {
    user,
    token: verifyRes.body.token || verifyRes.body.accessToken || verifyRes.body.data?.token,
    refreshToken: verifyRes.body.refreshToken || verifyRes.body.data?.refreshToken,
  };
};

describe("Authentication & User Flows", () => {
  describe("Registration", () => {
    it("rejects weak password registration", async () => {
      const res = await request(app).post("/api/auth/register").send(weakUser);
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid email format", async () => {
      const res = await request(app).post("/api/auth/register").send(invalidEmailUser);
      expect(res.statusCode).toBe(400);
    });

    it("registers a valid user and requires OTP verification", async () => {
      const res = await request(app).post("/api/auth/register").send(validUser);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.requiresVerification).toBe(true);
      expect(res.body.token).toBeUndefined();
    });

    it("rejects duplicate verified email registration", async () => {
      await registerAndVerify();

      const res = await request(app).post("/api/auth/register").send({
        ...validUser,
        phone: "9999999999",
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe("Login", () => {
    it("rejects login for non-existing user", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "Password123",
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects login with wrong password", async () => {
      await registerAndVerify();

      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: "WrongPassword123",
      });

      expect(res.statusCode).toBe(401);
    });

    it("logs in with correct credentials and returns tokens", async () => {
      await registerAndVerify();

      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: validUser.password,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.token || res.body.accessToken || res.body.data?.token).toBeTruthy();
      expect(res.body.refreshToken || res.body.data?.refreshToken).toBeTruthy();
    });
  });

  describe("Protected Route & Refresh Token", () => {
    it("denies profile access without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.statusCode).toBe(401);
    });

    it("denies profile access with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.jwt.token");

      expect(res.statusCode).toBe(401);
    });

    it("allows profile access with a valid access token", async () => {
      const { token, user } = await registerAndVerify();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.email).toBe(user.email);
    });

    it("rotates refresh tokens and rejects a used refresh token", async () => {
      const { refreshToken } = await registerAndVerify();

      const first = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      expect(first.statusCode).toBe(200);
      expect(first.body.refreshToken || first.body.data?.refreshToken).toBeTruthy();

      const reused = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      expect(reused.statusCode).toBe(401);
    });
  });
});
