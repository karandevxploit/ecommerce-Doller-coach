const axios = require("axios");

const BASE_URL = "http://localhost:7000/api";
const ADMIN_SECRET = "karan_super_admin_key_123";

async function verify() {
  const email = `admin_test_${Date.now()}@example.com`;
  const password = "password123";
  const name = "Test Admin";

  console.log("--- START VERIFICATION ---");

  try {
    // 1. Check if admin exists
    console.log("Checking if admin exists...");
    const existsRes = await axios.get(`${BASE_URL}/auth/admin-exists`);
    console.log("Admin exists:", existsRes.data.exists);

    if (existsRes.data.exists) {
      console.log("Admin already exists. Skipping registration test or using existing admin.");
      // I'll try to login with a known account if I had one, but better to test the whole flow.
      // For this test, I'll just assume I can register if it doesn't exist.
    } else {
      // 2. Register Admin
      console.log(`Registering admin: ${email}...`);
      const regRes = await axios.post(`${BASE_URL}/auth/admin-register`, {
        name,
        email,
        password,
        secret: ADMIN_SECRET,
        provider: "email"
      });
      console.log("Register Response:", regRes.data);
      if (regRes.status === 201) console.log("✅ Admin Registration Success (201)");
    }

    // 3. Login Admin
    // If I just registered, I use that email. If not, I'll need a valid email.
    const loginEmail = existsRes.data.exists ? "admin@example.com" : email; // Fallback to something if exists
    
    console.log(`Logging in admin: ${loginEmail}...`);
    try {
        const loginRes = await axios.post(`${BASE_URL}/auth/admin-login`, {
          email: loginEmail,
          password: password,
          provider: "email"
        });
        console.log("Login Response:", loginRes.data);
        if (loginRes.status === 200) console.log("✅ Admin Login Success (200)");
    } catch (err) {
        console.error("❌ Login failed:", err.response?.data || err.message);
    }

  } catch (err) {
    console.error("❌ Verification failed:", err.response?.data || err.message);
  }

  console.log("--- END ---");
}

verify();
