const SibApiV3Sdk = require("sib-api-v3-sdk");
const { logger } = require("./logger");
const env = require("../config/env");
const {
  otpEmail,
  orderAdminEmail,
  productAnnouncementEmail,
} = require("./emailTemplates");

// 1. Initial configuration check
const apiKeyVal = env.BREVO_API_KEY;
if (!apiKeyVal) {
  logger.error("[BREVO CRITICAL] BREVO_API_KEY is missing from environment config!");
} else {
  logger.info(`[BREVO CONFIG] API Key loaded`);
}

/**
 * Utility: Extract Name and Email from MAIL_FROM
 */
const getSenderInfo = () => {
  const mailFrom = env.MAIL_FROM || "Doller Coach <dollercoach@gmail.com>";
  const match = mailFrom.match(/^(.*)<(.*)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: "Doller Coach", email: mailFrom.trim() };
};

const getAdminEmail = () =>
  process.env.ADMIN_EMAIL ||
  env.COMPANY_EMAIL ||
  getSenderInfo().email;

const isValidEmail = (email) => {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const getProviderError = (error) => {
  if (error?.response?.body) return JSON.stringify(error.response.body);
  if (error?.body) return JSON.stringify(error.body);
  if (Array.isArray(error?.errors) && error.errors.length) {
    return error.errors
      .map((item) => `${item.code || item.name || "ERROR"} ${item.address || ""}:${item.port || ""}`.trim())
      .join("; ");
  }
  return error?.message || String(error || "Unknown email provider error");
};

const getBrevoClient = () => {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  defaultClient.authentications["api-key"].apiKey = env.BREVO_API_KEY;
  return new SibApiV3Sdk.TransactionalEmailsApi();
};

/**
 * CORE: Unified Send Email Function
 */
const sendEmailCore = async ({ to, bcc, subject, html, attachments }) => {
  const recipient = Array.isArray(to) ? to[0] : to;
  const requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[Brevo TRACE][${requestId}] START: Attempting to send "${subject}" to ${recipient}`);

    if (!recipient) throw new Error("Recipient email is missing");
    if (!isValidEmail(recipient)) throw new Error(`Invalid email format: ${recipient}`);

    if (!env.BREVO_API_KEY) throw new Error("BREVO_API_KEY is missing");

    const sender = getSenderInfo();
    const email = new SibApiV3Sdk.SendSmtpEmail();

    email.sender = sender;
    email.to = [{ email: recipient }];
    email.subject = subject;
    email.htmlContent = html;
    
    if (bcc && Array.isArray(bcc) && bcc.length) {
      email.bcc = bcc.filter(isValidEmail).map((emailAddress) => ({ email: emailAddress }));
    }

    if (attachments && Array.isArray(attachments) && attachments.length) {
      email.attachment = attachments.map((attachment) => ({
        name: attachment.filename || "document.pdf",
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString("base64")
          : attachment.content,
      }));
    }

    const result = await getBrevoClient().sendTransacEmail(email);
    logger.info(`[Brevo SUCCESS][${requestId}] MessageID: ${result?.messageId || result?.body?.messageId || "sent"}`);
    return result;
  } catch (error) {
    const errorDetail = getProviderError(error);
    logger.error(`[Brevo ERROR][${requestId}] Failed for ${recipient}: ${errorDetail}`);
    throw error;
  }
};

/**
 * PRODUCTION-GRADE: Queue Email for background processing
 */
const queueEmail = async (payload) => {
  try {
    if (env.NODE_ENV === "test" && process.env.EMAIL_TEST_MODE !== "real") {
      logger.info("[EMAIL_TEST_MODE] Skipping provider delivery", {
        to: payload?.to,
        subject: payload?.subject,
      });
      return true;
    }

    await sendEmailCore(payload);

    // Queue is kept only as a best-effort audit/background copy. Delivery does not depend on Redis/worker.
    if (env.REDIS_ENABLED && env.ENABLE_QUEUE) {
      try {
        const { emailQueue } = require("../services/queue.service");
        emailQueue.add("send-email", payload).catch((error) => {
          logger.warn("[EMAIL_QUEUE_AUDIT_SKIP]", { error: error.message });
        });
      } catch (queueError) {
        logger.warn("[EMAIL_QUEUE_AUDIT_SKIP]", { error: queueError.message });
      }
    }

    return true;
  } catch (error) {
    logger.error("[EMAIL_SEND_FAILED]", { error: error.message, to: payload?.to, subject: payload?.subject });
    throw error;
  }
};

/**
 * 📧 EMAIL WORKER FIX (SAFE MODE)
 * Prevents hanging during external provider latency.
 */
const sendEmailSafe = async (data) => {
  try {
    // ARCHITECT: Race against 8s timeout to prevent process contention
    await Promise.race([
      sendEmailCore(data),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email provider timeout (8s limit reached)")), 8000)
      ),
    ]);
  } catch (err) {
    logger.error("EMAIL_SEND_FAILURE_SAFE_MODE:", err.message);
  }
};



const BRAND_COLOR = "#000000";
const SECONDARY_COLOR = "#999999";

/**
 * Pre-configured template for sending New Product Alerts
 */
const sendOtpEmail = async ({ to, name, otp, minutes }) => {
  return queueEmail({
    to,
    subject: "Verify your Doller Coach email",
    html: otpEmail({ name, otp, minutes }),
  });
};

const sendAdminOrderEmail = async ({ order, customer }) => {
  return queueEmail({
    to: getAdminEmail(),
    subject: `New order received - ${order?.invoiceNumber || order?._id || "Doller Coach"}`,
    html: orderAdminEmail({ order, customer }),
  });
};

const sendNewProductAnnouncementEmail = async ({ product, recipients = [] }) => {
  const cleanRecipients = [...new Set(recipients.filter(isValidEmail))];
  if (!cleanRecipients.length) return false;

  const shopUrl = `${process.env.FRONTEND_URL || env.CLIENT_URL || "http://localhost:3000"}/product/${product?._id || product?.id || ""}`;
  const [to, ...bcc] = cleanRecipients;

  return queueEmail({
    to,
    bcc,
    subject: `New drop: ${product?.name || product?.title || "Doller Coach product"}`,
    html: productAnnouncementEmail({ product, shopUrl }),
  });
};

const sendNewProductEmail = async (product) => {
  try {
    return await queueEmail({
      to: getAdminEmail(),
      subject: `New Product Added: ${product?.name || product?.title || "Unknown"}`,
      html: `
        <div style="font-family: sans-serif; color: ${BRAND_COLOR};">
          <h2>New Product Added</h2>
          <p>A new product has been successfully added to your catalog.</p>
          <ul>
            <li><strong>Name:</strong> ${product?.name || product?.title || "Unknown"}</li>
            <li><strong>Price:</strong> Rs.${product?.price || 0}</li>
            <li><strong>Category:</strong> ${product?.category?.name || product?.category || "General"}</li>
          </ul>
        </div>
      `
    });
  } catch (error) {
    logger.error("Failed to enqueue New Product Email");
    // Do not throw to prevent upstream synchronous crashes
  }
};

module.exports = {
  sendEmail: queueEmail,
  sendEmailImmediate: sendEmailCore,
  sendEmailSafe,
  sendOtpEmail,
  sendAdminOrderEmail,
  sendNewProductAnnouncementEmail,
  sendNewProductEmail,
  BRAND_COLOR,
  SECONDARY_COLOR
};
