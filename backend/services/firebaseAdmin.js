// config/firebase.js

const admin = require("firebase-admin");
const { logger } = require("../utils/logger");

function parseServiceKey(raw) {
  if (!raw) return null;

  try {
    if (typeof raw === "object") return raw;
    return JSON.parse(raw);
  } catch (err) {
    logger.error("[Firebase] Invalid service key JSON");
    return null;
  }
}

function validateServiceKey(key) {
  return (
    key &&
    key.project_id &&
    key.private_key &&
    key.client_email
  );
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  const serviceKey = parseServiceKey(process.env.FIREBASE_SERVICE_KEY);

  if (!validateServiceKey(serviceKey)) {
    logger.warn("[Firebase] Not initialized (missing/invalid config)");
    return null; // ⚠️ return null instead of broken admin
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceKey),
    });

    logger.info("[Firebase] Initialized successfully");
    return admin;

  } catch (err) {
    logger.error("[Firebase] Initialization failed:", err.message);
    return null;
  }
}

const firebaseAdmin = initFirebaseAdmin();

module.exports = { firebaseAdmin };