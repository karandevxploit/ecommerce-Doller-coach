const SibApiV3Sdk = require("sib-api-v3-sdk");
const { logger } = require("./logger");
const env = require("../config/env");

// 1. Initial configuration check
const apiKeyVal = env.BREVO_API_KEY;
if (!apiKeyVal) {
  logger.error("[BREVO CRITICAL] BREVO_API_KEY is missing from environment config!");
} else {
  const safeStr = typeof apiKeyVal === "string" ? apiKeyVal : String(apiKeyVal);
  logger.info(`[BREVO CONFIG] API Key loaded (starts with: ${safeStr.substring(0, 10)}...)`);
}

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = apiKeyVal;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

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

const isValidEmail = (email) => {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const { emailQueue } = require("../services/queue.service");

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

    const sender = getSenderInfo();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.sender = sender;
    sendSmtpEmail.to = [{ email: recipient }];

    if (bcc && Array.isArray(bcc) && bcc.length) {
      sendSmtpEmail.bcc = bcc.filter(isValidEmail).map(email => ({ email }));
    }

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;

    if (attachments && Array.isArray(attachments) && attachments.length) {
      sendSmtpEmail.attachment = attachments.map(att => ({
        content: Buffer.isBuffer(att.content) ? att.content.toString("base64") : att.content,
        name: att.filename || "document.pdf"
      }));
    }

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`[Brevo SUCCESS][${requestId}] MessageID: ${result.messageId}`);
    return result;
  } catch (error) {
    let errorDetail = error.message;
    if (error.response && error.response.body) {
      errorDetail = JSON.stringify(error.response.body);
    }
    logger.error(`[Brevo ERROR][${requestId}] Failed for ${recipient}: ${errorDetail}`);
    throw error;
  }
};

/**
 * PRODUCTION-GRADE: Queue Email for background processing
 */
const queueEmail = async (payload) => {
  try {
    const job = await emailQueue.add("send-email", payload);
    // If Redis is down or job wasn't created, queue.service bypasses and returns { id: "deferred" }
    if (!job || job.id === "deferred") {
       logger.warn("[EMAIL_QUEUE] Queue bypassing tasks. Activating direct send fallback.");
       await sendEmailCore(payload);
    }
    return true;
  } catch (error) {
    logger.error("[EMAIL_QUEUE] Add to queue failed. Activating direct send fallback.", { error: error.message });
    // Fallback if queueing fails completely
    return sendEmailCore(payload).catch(e => logger.error("Email Direct Fallback Failed", { error: e.message }));
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
    logger.error("⚡ EMAIL_SEND_FAILURE_SAFE_MODE:", err.message);
  }
};



const BRAND_COLOR = "#000000";
const SECONDARY_COLOR = "#999999";

/**
 * Pre-configured template for sending New Product Alerts
 */
const sendNewProductEmail = async (product) => {
  try {
    const adminEmail = getSenderInfo().email; // Route to admin by default
    return await queueEmail({
      to: adminEmail,
      subject: `New Product Added: ${product?.title || "Unknown"}`,
      html: `
        <div style="font-family: sans-serif; color: ${BRAND_COLOR};">
          <h2>New Product Added</h2>
          <p>A new product has been successfully added to your catalog.</p>
          <ul>
            <li><strong>Name:</strong> ${product?.title}</li>
            <li><strong>Price:</strong> $${product?.price}</li>
            <li><strong>Category:</strong> ${product?.category}</li>
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
  sendEmail: queueEmail, // High-performance default
  sendEmailImmediate: sendEmailCore, // For critical sync alerts
  sendNewProductEmail,
  BRAND_COLOR,
  SECONDARY_COLOR
};
