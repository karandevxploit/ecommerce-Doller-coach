const bcrypt = require("bcryptjs");
const AuthService = require("../services/auth.service");
const Category = require("../models/category.model");
const User = require("../models/user.model");

const createTestUser = async ({
  name = "Test User",
  email = `user-${Date.now()}-${Math.random()}@example.com`,
  role = "user",
  password = "Password123",
  phone = `9${String(Date.now()).slice(-5)}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
} = {}) => {
  const user = await User.create({
    name,
    email,
    phone,
    role,
    provider: "email",
    password: await bcrypt.hash(password, 12),
    emailVerified: true,
    isVerified: true,
  });

  return {
    user,
    token: AuthService.generateAccessToken(user),
  };
};

const createTestCategory = async (overrides = {}) =>
  Category.create({
    name: `Test Category ${Date.now()} ${Math.random()}`,
    gender: "men",
    type: "top",
    sizes: ["S", "M", "L"],
    ...overrides,
  });

module.exports = {
  createTestUser,
  createTestCategory,
};
