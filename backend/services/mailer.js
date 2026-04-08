const nodemailer = require("nodemailer");

function getTransport() {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendMail({ to, bcc, subject, text, html, attachments }) {
  const transport = getTransport();
  if (!transport) {
    const err = new Error("SMTP is not configured (EMAIL_USER / EMAIL_PASS)");
    err.statusCode = 503;
    throw err;
  }

  const from =
    process.env.MAIL_FROM ||
    process.env.EMAIL_FROM ||
    `Doller Coach <${process.env.EMAIL_USER || process.env.SMTP_USER}>`;
  const toList = Array.isArray(to) ? to : [to];
  try {
    const info = await transport.sendMail({
      from,
      to: toList[0],
      bcc: bcc || toList.slice(1),
      subject,
      text,
      html: html || text,
      attachments: attachments || undefined,
    });
    return info;
  } catch (error) {
    console.error("MAILER [sendMail]: ERROR", {
      message: error.message,
      code: error.code,
      command: error.command,
      address: error.address,
    });
    throw error;
  }
}

module.exports = { sendMail, getTransport };
