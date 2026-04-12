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
const cookieParser = require("cookie-parser");
const http = require("http");
const requestTracker = require("./middlewares/requestTracker");
const performanceTracker = require("./middlewares/performance.middleware");
const governor = require("./middlewares/governor.middleware");
const realtimeService = require("./services/realtime.service");

logger.info("--- SYSTEM STARTUP ---");
logger.info(`PORT: ${process.env.PORT || 7000}`);
logger.info(`ADMIN_SECRET loaded: ${Boolean(process.env.ADMIN_SECRET)}`);
logger.info("----------------------");

const app = express();

// 0. Failure & Loop Protection (Critical Edge Safeguard)
app.use(governor);
app.use(requestTracker);
app.use(performanceTracker);

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
  logger.error("CRITICAL: Uncaught Exception! Shutting down gracefully...", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  logger.error("CRITICAL: Unhandled Rejection! Shutting down gracefully...", {
    error: err.message,
    stack: err.stack,
  });
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
app.use(cookieParser());
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

const redis = require("./config/redis");
const { RedisStore } = require("rate-limit-redis");

// 4. Global API Rate Limiting (Guard against client-side loops)
const rateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  limit: env.NODE_ENV === "production" ? 60 : 300, 
  message: { success: false, message: "Request limit exceeded. Possible loop detected." },
  standardHeaders: true,
  legacyHeaders: false,
};

// High-Availability Store Selection
if (redis && !redis.isMock) {
  try {
    rateLimitOptions.store = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    });
    logger.info("RateLimiter: Using Distributed Redis Store.");
  } catch (err) {
    logger.warn("RateLimiter: Redis Store failed to initialize. Falling back to memory.", { error: err.message });
  }
} else {
  logger.info("RateLimiter: Using local In-Memory Store (Mock Active).");
}

app.use("/api", rateLimit(rateLimitOptions));

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

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const server = http.createServer(app);

  // Initialize Real-Time Telemetry
  realtimeService.initialize(server);

  // 1. Start listening IMMEDIATELY (Crucial for Render/Cloud ports)
  server.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`[PRODUCTION] Server opened port ${env.PORT} on 0.0.0.0`);
    logger.info(`Mode: ${env.NODE_ENV}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.error(`Port ${env.PORT} is already in use. Retrying in 1s...`);
      setTimeout(() => {
        server.close();
        server.listen(env.PORT, "0.0.0.0");
      }, 1000);
    } else {
      logger.error("Server Start Error:", err);
    }
  });

  // 2. Initialize DB and Maintenance in background
  connectDB().then(async () => {
    try {
      await User.updateMany({ googleId: null }, { $unset: { googleId: 1 } });
      logger.info("Startup maintenance complete.");
    } catch (e) {
      logger.warn("Startup maintenance failed", { error: e.message });
    }
  }).catch(err => {
    logger.error("CRITICAL: Database initialization failed", { error: err.message });
  });

  // 3. Graceful Shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      mongoose.connection.close(false).then(() => {
        logger.info("Database connection closed.");
        process.exit(0);
      });
    });

    // Force shutdown after 10s if graceful fails
    setTimeout(() => {
      logger.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = app;
