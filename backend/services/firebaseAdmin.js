const admin = require("firebase-admin");

function parseServiceKey(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return admin;

  const serviceKey = parseServiceKey(process.env.FIREBASE_SERVICE_KEY);
  if (!serviceKey) {
    // Allow server to boot without Firebase for non-notification paths.
    // Endpoints that need Firebase should handle missing config.
    return admin;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceKey),
  });

  return admin;
}

module.exports = { admin: initFirebaseAdmin() };

