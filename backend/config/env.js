const { z } = require("zod");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config();
}

// ---------- HELPERS ----------
const emptyToUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str === "" ? undefined : str;
};

const optionalString = () => z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = () => z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalEmail = () => z.preprocess(emptyToUndefined, z.string().email().optional());

const toNumber = (value, fallback) => {
  const raw = emptyToUndefined(value);
  if (raw === undefined) return fallback;

  const num = Number(raw);
  if (!Number.isFinite(num)) throw new Error("Invalid number");
  return num;
};

const toBoolean = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(raw)) return true;
  if (["false", "0", "no", "n", "off", ""].includes(raw)) return false;
  return false;
};

const withDefault = (key, fallback) => emptyToUndefined(process.env[key]) || fallback;

process.env.CLIENT_URL = withDefault("CLIENT_URL", process.env.FRONTEND_URL || "http://localhost:5173");
process.env.GOOGLE_CALLBACK_URL = withDefault(
  "GOOGLE_CALLBACK_URL",
  `http://localhost:${process.env.PORT || 8001}/api/auth/google/callback`
);
process.env.SHIPROCKET_API_URL = withDefault(
  "SHIPROCKET_API_URL",
  "https://apiv2.shiprocket.in/v1/external"
);
process.env.REDIS_URL = withDefault("REDIS_URL", "redis://127.0.0.1:6379");

// ---------- BASE SCHEMA ----------
const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.preprocess(
    (value) => toNumber(value, 8001),
    z.number().int().positive().max(65535)
  ),

  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.preprocess((value) => toNumber(value, 3306), z.number().int().positive().max(65535)),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: optionalString(),
  MYSQL_DATABASE: z.string().default("doller_coach"),

  JWT_SECRET: z.string().min(16).default("dev_jwt_secret_change_me_min_32_chars"),
  REFRESH_TOKEN_SECRET: z.string().min(16).default("dev_refresh_secret_change_me_min_32_chars"),

  CLIENT_URL: z.string().url(),
  FRONTEND_URL: optionalUrl(),
  BASE_URL: optionalUrl(),
  PUBLIC_BACKEND_URL: optionalUrl(),
  CORS_ORIGINS: optionalString(),

  RAZORPAY_KEY_ID: optionalString(),
  RAZORPAY_KEY_SECRET: optionalString(),

  BREVO_API_KEY: optionalString(),
  MAIL_FROM: z.string().default("Doller Coach <no-reply@example.com>"),

  REDIS_ENABLED: z.preprocess(toBoolean, z.boolean()).default(true),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  ENABLE_QUEUE: z.preprocess(toBoolean, z.boolean()).default(false),

  GOOGLE_CLIENT_ID: optionalString(),
  GOOGLE_CLIENT_SECRET: optionalString(),
  GOOGLE_CALLBACK_URL: z.string().url(),

  ADMIN_SECRET: z.string().min(8).default("dev_admin_secret"),
  INTERNAL_TEST_SECRET: z.string().min(8).default("dev_internal_test_secret"),

  SHIPROCKET_EMAIL: optionalEmail(),
  SHIPROCKET_PASSWORD: optionalString(),
  SHIPROCKET_API_URL: optionalUrl(),

  COMPANY_NAME: optionalString(),
  COMPANY_LOGO_URL: optionalString(),
  COMPANY_PHONE: optionalString(),
  COMPANY_EMAIL: optionalEmail(),
  COMPANY_GST: optionalString(),
});

// ---------- ENV-SPECIFIC RULES ----------
const envSchema = baseSchema.superRefine((data, ctx) => {
  if (data.REDIS_ENABLED && !data.REDIS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["REDIS_URL"],
      message: "REDIS_URL required when REDIS_ENABLED=true",
    });
  }

  const hasGoogleClient = Boolean(data.GOOGLE_CLIENT_ID);
  const hasGoogleSecret = Boolean(data.GOOGLE_CLIENT_SECRET);
  if (hasGoogleClient !== hasGoogleSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GOOGLE_CLIENT_ID"],
      message: "Provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET together",
    });
  }

  const hasShiprocketEmail = Boolean(data.SHIPROCKET_EMAIL);
  const hasShiprocketPassword = Boolean(data.SHIPROCKET_PASSWORD);
  if (hasShiprocketEmail !== hasShiprocketPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SHIPROCKET_EMAIL"],
      message: "Provide both SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD together",
    });
  }

  const hasRazorpayKey = Boolean(data.RAZORPAY_KEY_ID);
  const hasRazorpaySecret = Boolean(data.RAZORPAY_KEY_SECRET);
  if (hasRazorpayKey !== hasRazorpaySecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_KEY_ID"],
      message: "Provide RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET together",
    });
  }

  if (data.NODE_ENV === "production") {
    const requiredProductionKeys = [
      "JWT_SECRET",
      "REFRESH_TOKEN_SECRET",
      "ADMIN_SECRET",
      "INTERNAL_TEST_SECRET",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "BREVO_API_KEY",
    ];

    requiredProductionKeys.forEach((key) => {
      if (!data[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    });

    if (data.JWT_SECRET.length < 32 || /secret|change_me|123/i.test(data.JWT_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "Weak JWT_SECRET detected",
      });
    }

    if (
      data.REFRESH_TOKEN_SECRET.length < 32 ||
      /secret|change_me|123/i.test(data.REFRESH_TOKEN_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REFRESH_TOKEN_SECRET"],
        message: "Weak REFRESH_TOKEN_SECRET detected",
      });
    }

    if (data.CLIENT_URL.includes("localhost")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLIENT_URL"],
        message: "CLIENT_URL cannot be localhost in production",
      });
    }
  }
});

// ---------- PARSE ----------
const result = envSchema.safeParse(process.env);

if (!result.success) {
  const zodIssues = result.error.issues || result.error.errors || [];
  const errors = zodIssues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  const message = `ENV VALIDATION FAILED: ${JSON.stringify(errors)}`;
  throw new Error(message);
}

// ---------- IMMUTABLE EXPORT ----------
module.exports = Object.freeze(result.data);
