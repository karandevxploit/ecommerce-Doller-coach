const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:7000/api";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET missing");
  process.exit(1);
}

async function verify() {
  const email = `admin_test_${Date.now()}@example.com`;
  const password = "Test@1234";

  let token = null;

  console.log("🚀 START ADMIN FLOW TEST\n");

  try {
    // 1. Register Admin
    console.log("🔹 Registering admin...");
    const regRes = await axios.post(`${BASE_URL}/auth/admin-register`, {
      name: "Test Admin",
      email,
      password,
      secret: ADMIN_SECRET,
      provider: "email"
    });

    if (regRes.status !== 201) {
      throw new Error("Registration failed");
    }

    console.log("✅ Registration success");

    // 2. Login
    console.log("🔹 Logging in...");
    const loginRes = await axios.post(`${BASE_URL}/auth/admin-login`, {
      email,
      password,
      provider: "email"
    });

    if (loginRes.status !== 200) {
      throw new Error("Login failed");
    }

    token = loginRes.data.token;

    if (!token) {
      throw new Error("Token missing in login response");
    }

    console.log("✅ Login success");

    // 3. Verify token (protected route)
    console.log("🔹 Verifying token access...");
    const profileRes = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (profileRes.data.role !== "admin") {
      throw new Error("User is not admin");
    }

    console.log("✅ Admin role verified");

    // 4. Negative test
    console.log("🔹 Testing invalid login...");
    try {
      await axios.post(`${BASE_URL}/auth/admin-login`, {
        email,
        password: "wrongpassword"
      });
      throw new Error("Invalid login should fail");
    } catch {
      console.log("✅ Invalid login rejected");
    }

    console.log("\n🎉 ALL TESTS PASSED");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
  }

  process.exit(0);
}

verify();