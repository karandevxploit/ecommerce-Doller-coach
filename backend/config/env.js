const { z } = require("zod");

require("dotenv").config();

// ---------- HELPERS ----------
const toNumber = (val) => {
  const num = Number(val);
  if (isNaN(num)) throw new Error("Invalid number");
  return num;
};

const toBoolean = (val) => {
  if (["true", "1", "yes"].includes(val?.toLowerCase())) return true;
  if (["false", "0", "no"].includes(val?.toLowerCase())) return false;
  return false;
};

// ---------- BASE SCHEMA ----------
const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.string()
    .transform(toNumber)
    .refine((val) => val > 0 && val < 65536, "Invalid PORT")
    .default("8001"),

  MONGO_URI: z.string().min(10, "MONGO_URI required"),

  JWT_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),

  CLIENT_URL: z.string().url(),

  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),

  BREVO_API_KEY: z.string().min(1),
  MAIL_FROM: z.string().default("Doller Coach <dollercoach@gmail.com>"),

  REDIS_ENABLED: z.string().transform(toBoolean).default("false"),
  REDIS_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  ADMIN_SECRET: z.string().min(16),
  INTERNAL_TEST_SECRET: z.string().min(32),

  RECAPTCHA_SECRET_KEY: z.string().optional(),
  RECAPTCHA_SITE_KEY: z.string().optional(),

  SHIPROCKET_EMAIL: z.string().email().optional(),
  SHIPROCKET_PASSWORD: z.string().min(6).optional(),
});

// ---------- ENV-SPECIFIC RULES ----------
const envSchema = baseSchema.superRefine((data, ctx) => {
  // Redis شرط
  if (data.REDIS_ENABLED && !data.REDIS_URL) {
    ctx.addIssue({
      path: ["REDIS_URL"],
      message: "REDIS_URL required when REDIS_ENABLED=true",
    });
  }

  // Production strict rules
  if (data.NODE_ENV === "production") {
    if (data.JWT_SECRET.includes("123") || data.JWT_SECRET.includes("secret")) {
      ctx.addIssue({
        path: ["JWT_SECRET"],
        message: "Weak JWT_SECRET detected",
      });
    }

    if (data.CLIENT_URL.includes("localhost")) {
      ctx.addIssue({
        path: ["CLIENT_URL"],
        message: "CLIENT_URL cannot be localhost in production",
      });
    }
  }
});

// ---------- PARSE ----------
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ ENV VALIDATION FAILED");

  // Safe logging (no sensitive values)
  const zodIssues = result.error.issues || result.error.errors || [];
  const errors = zodIssues.map(err => ({
    field: err.path.join("."),
    message: err.message
  }));

  console.error(errors);
  process.exit(1);
}

// ---------- IMMUTABLE EXPORT ----------
module.exports = Object.freeze(result.data);