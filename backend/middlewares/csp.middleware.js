const crypto = require("crypto");
const env = require("../config/env");

// ===============================
// CONFIG
// ===============================
const isProd = env.NODE_ENV === "production";

// ===============================
// CSP MIDDLEWARE
// ===============================
module.exports = (req, res, next) => {
  // Generate strong nonce
  const nonce = crypto.randomBytes(16).toString("base64");

  res.locals.nonce = nonce;

  // ===============================
  // BUILD CSP POLICY
  // ===============================
  let csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://trusted.cdn.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: https://res.cloudinary.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://api.yourdomain.com`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];

  // Dev mode relaxation (optional)
  if (!isProd) {
    csp.push(`script-src 'self' 'unsafe-eval' 'unsafe-inline'`);
  }

  // ===============================
  // SET HEADERS
  // ===============================
  res.setHeader("Content-Security-Policy", csp.join("; "));

  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
};