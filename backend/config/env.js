const { z } = require("zod");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).default("1000"),
  MONGO_URI: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters"),
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET should be at least 32 characters"),
  CLIENT_URL: z.string(),
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_KEY_SECRET: z.string(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  BREVO_API_KEY: z.string().min(1, "BREVO_API_KEY is required for emails"),
  MAIL_FROM: z.string().default("Doller Coach <dollercoach@gmail.com>"),
  REDIS_URL: z.string().url("Valid REDIS_URL is required for caching and queues"),
});

const envVars = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  MAIL_FROM: process.env.MAIL_FROM,
  REDIS_URL: process.env.REDIS_URL,
};

const result = envSchema.safeParse(envVars);

if (!result.success) {
  console.error("❌ Invalid environment variables:", result.error.format());
  process.exit(1);
}

module.exports = result.data;
