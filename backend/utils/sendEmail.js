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

/**
 * CORE: Unified Send Email Function with "Nuclear" Logging
 */
const sendEmailCore = async ({ to, bcc, subject, html, attachments }) => {
  const recipient = Array.isArray(to) ? to[0] : to;
  const requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[Brevo TRACE][${requestId}] START: Attempting to send "${subject}" to ${recipient}`);

    // 1. Validation
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

    // Handle Attachments
    if (attachments && Array.isArray(attachments) && attachments.length) {
      sendSmtpEmail.attachment = attachments.map(att => ({
        content: Buffer.isBuffer(att.content) ? att.content.toString("base64") : att.content,
        name: att.filename || "document.pdf"
      }));
    }

    logger.debug(`[Brevo TRACE][${requestId}] PAYLOAD: Sender=${sender.email}, To=${recipient}`);

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

const BRAND_COLOR = "#000000";
const SECONDARY_COLOR = "#999999";

exports.sendEmail = sendEmailCore;

exports.sendOrderToAdmin = async (order) => {
  const adminEmail = process.env.ADMIN_EMAIL || "karanyadav.hack.dev@gmail.com";
  return sendEmailCore({ 
    to: adminEmail, 
    subject: "🛒 New Order Received", 
    html: `<h1>New Order Received</h1><p>Order ID: ${order._id}</p>` 
  });
};
