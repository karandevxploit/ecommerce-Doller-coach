const SibApiV3Sdk = require('sib-api-v3-sdk');
const path = require('path');
const dotenv = require('dotenv');

// 1. Manually Load Env
const result = dotenv.config({ path: path.join(__dirname, 'backend', '.env') });
if (result.error) {
  console.error("Failed to load .env file", result.error);
  process.exit(1);
}

const apiKeyVal = process.env.BREVO_API_KEY;
const senderVal = process.env.MAIL_FROM || "Doller Coach <dollercoach@gmail.com>";

console.log("--- Brevo API Standalone Test ---");
console.log("API Key found:", apiKeyVal ? (apiKeyVal.substring(0, 10) + "...") : "MISSING");
console.log("Sender:", senderVal);

// 2. Setup SDK
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = apiKeyVal;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

let senderInfo = { name: "Doller Coach", email: "dollercoach@gmail.com" };
const match = senderVal.match(/^(.*)<(.*)>$/);
if (match) {
  senderInfo = { name: match[1].trim(), email: match[2].trim() };
} else {
  senderInfo = { name: "Doller Coach", email: senderVal.trim() };
}

sendSmtpEmail.subject = "Standalone Debug Test";
sendSmtpEmail.htmlContent = "<html><body><h1>API Test SUCCESS</h1><p>If you see this, the Brevo SDK is working fine.</p></body></html>";
sendSmtpEmail.sender = senderInfo;
sendSmtpEmail.to = [{ email: "karanyadav.hack.dev@gmail.com" }]; // Testing to user's known address

async function runTest() {
  try {
    console.log("Attempting to send email...");
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("API SUCCESS. Message ID:", data.messageId);
    process.exit(0);
  } catch (error) {
    console.error("API FAILURE:");
    if (error.response && error.response.body) {
      console.error(JSON.stringify(error.response.body, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runTest();
