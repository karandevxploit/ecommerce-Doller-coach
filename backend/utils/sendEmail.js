const SibApiV3Sdk = require("sib-api-v3-sdk");
const logger = require("./logger");
const env = require("../config/env");

// 1. Initial configuration check
const apiKeyVal = env.BREVO_API_KEY || process.env.BREVO_API_KEY;
if (!apiKeyVal) {
  logger.error("[BREVO CRITICAL] BREVO_API_KEY is missing from environment!");
} else {
  logger.info(`[BREVO CONFIG] API Key loaded (starts with: ${apiKeyVal.substring(0, 10)}...)`);
}

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = apiKeyVal;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Utility: Extract Name and Email from MAIL_FROM
 */
const getSenderInfo = () => {
  const mailFrom = env.MAIL_FROM || process.env.MAIL_FROM || "Doller Coach <dollercoach@gmail.com>";
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
  const job = await emailQueue.add("send-email", payload);
  if (!job) {
    // Fallback if queueing fails
    return sendEmailCore(payload).catch(e => logger.error("Email Fallback Failed", { error: e.message }));
  }
  return true;
};

// Initialize Background Worker (For single-process development)
if (process.env.START_EMAIL_WORKER === "true") {
  emailQueue.process(sendEmailCore).catch(e => logger.error("Email Worker Crash", { error: e.message }));
}

const BRAND_COLOR = "#000000";
const SECONDARY_COLOR = "#999999";

module.exports = {
  sendEmail: queueEmail, // High-performance default
  sendEmailImmediate: sendEmailCore, // For critical sync alerts
  BRAND_COLOR,
  SECONDARY_COLOR
};
