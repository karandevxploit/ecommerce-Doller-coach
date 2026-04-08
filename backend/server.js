const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });
const logger = require("./utils/logger");
const env = require("./config/env");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

logger.info("--- SYSTEM STARTUP ---");
logger.info(`PORT: ${process.env.PORT || 7000}`);
logger.info(`ADMIN_SECRET loaded: ${Boolean(process.env.ADMIN_SECRET)}`);
logger.info("----------------------");

const app = express();

// 1. Absolute CORS Priority (Nuclear Fix)
const allowedOrigins = (env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === "undefined" || origin === "null") return callback(null, true);
      const sanitizedOrigin = origin.replace(/\/$/, "");
      
      // Strict list check
      if (allowedOrigins.includes(sanitizedOrigin)) return callback(null, true);
      
      // Dynamic Vercel Branch Support
      if (/\.vercel\.app$/.test(sanitizedOrigin)) return callback(null, true);
      
      // Localhost bypass for dev
      if (env.NODE_ENV === "development" && /localhost/.test(sanitizedOrigin)) return callback(null, true);
      
      logger.warn(`Rejected CORS request from origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 200,
  })
);
process.on("uncaughtException", (err) => {
  console.error("CRITICAL: Uncaught Exception! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("CRITICAL: Unhandled Rejection! Shutting down...");
  console.error(err);
  process.exit(1);
});

const mongoSanitize = require("express-mongo-sanitize");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const reviewRoutes = require("./routes/review.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");
const offerRoutes = require("./routes/offer.routes");
const notificationRoutes = require("./routes/notification.routes");
const adminRoutes = require("./routes/admin.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const uploadRoutes = require("./routes/upload.routes");
const couponRoutes = require("./routes/coupon.routes");
const connectDB = require("./config/db");
const configController = require("./controllers/config.controller");
const { errorHandler, notFound } = require("./middlewares/error.middleware");

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("./models/user.model");

// 2. Trust Proxy (Crucial for Render/Vercel)
app.set("trust proxy", 1);

// 3. Security & Optimization
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
}));
app.use(mongoSanitize());

// End of Nuclear CORS block

app.use(express.json({ 
  limit: "10mb",
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
}

app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  limit: env.NODE_ENV === "production" ? 100 : 1000, // Strict production limit, loose dev limit
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
}));

// Sessions required for OAuth handshake
app.use(
  session({
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
      ttl: 14 * 24 * 60 * 60,
    }),
  })
);

// Passport OAuth setup
app.use(passport.initialize());
app.use(passport.session());

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
  logger.warn("Google OAuth is not fully configured.");
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails && profile.emails.length ? profile.emails[0].value : null;
          const name = profile.displayName || "Google User";

          let user = await User.findOne({ googleId });
          if (!user && email) {
            user = await User.findOne({ email });
          }

          if (!user) {
            const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12); // Rounds 12
            user = await User.create({
              name,
              email: email || `user_${googleId}@example.com`,
              phone: null,
              password: passwordHash,
              role: "user",
              googleId,
              provider: "email",
              emailVerified: true,
              phoneVerified: false,
              isVerified: true,
            });
          } else {
            user.googleId = googleId;
            if (email) user.email = email;
            user.name = name || user.name;
            user.emailVerified = true;
            user.isVerified = true;
            await user.save();
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user._id.toString()));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).lean();
      done(null, user);
    } catch (e) {
      done(e);
    }
  });
}

app.get("/", (_req, res) => res.status(200).json({ status: "healthy", timestamp: new Date() }));
app.get("/health", (_req, res) => res.json({ ok: true, environment: env.NODE_ENV, db: mongoose.connection.readyState === 1 }));

// Mounting routes with and without /api prefix for maximum compatibility
const mountRoutes = (prefix = "") => {
  // Core routes
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/products`, productRoutes);
  app.use(`${prefix}/reviews`, reviewRoutes);
  app.use(`${prefix}/cart`, cartRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/payment`, paymentRoutes);
  app.use(`${prefix}/offers`, offerRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/wishlist`, wishlistRoutes);
  app.use(`${prefix}/upload`, uploadRoutes);
  app.use(`${prefix}/coupons`, couponRoutes);

  // Global Configuration (Public)
  if (configController && configController.getConfig) {
    app.get(`${prefix}/config`, configController.getConfig);
  } else {
    logger.error(`[CRITICAL] configController.getConfig is undefined for prefix: ${prefix}`);
  }
};

mountRoutes("/api");
if (env.NODE_ENV === "production") {
  mountRoutes(""); // Fallback for root-level calls in production
}

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  // 1. Establish Database Connection first
  connectDB().then(async () => {
    try {
      // 2. Perform minor startup maintenance
      await User.updateMany({ googleId: null }, { $unset: { googleId: 1 } });
    } catch (e) {
      logger.warn("googleId null cleanup failed during startup", { error: e.message });
    }

    // 3. Start listening only when DB is ready
    app.listen(env.PORT, () => {
      logger.info(`Backend running on ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  });
}

module.exports = app;
