const User = require("../models/user.model");
const { sendEmail } = require("../utils/sendEmail");

function adminEmails() {
  const raw = process.env.ADMIN_EMAIL || "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv;
}

async function resolveAdminEmails() {
  const env = adminEmails();
  if (env.length) return env;
  const admins = await User.find({ role: "admin" }).select("email").lean();
  return admins.map((a) => a.email).filter(Boolean);
}

async function safeSend(fn) {
  try {
    await fn();
  } catch (e) {
    console.warn("[email] skipped:", e?.message || e);
  }
}

const MEN_FALLBACK = "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800&auto=format&fit=crop";
const WOMEN_FALLBACK = "https://images.unsplash.com/photo-1539109132381-381005a4c8f5?q=80&w=800&auto=format&fit=crop";
const getFallback = (cat) => (String(cat).toUpperCase() === "WOMEN" ? WOMEN_FALLBACK : MEN_FALLBACK);

async function sendOrderPlacedEmails({ order, customer }) {
  const admins = await resolveAdminEmails();
  const orderId = String(order._id);
  const orderRef = order._id.toString().slice(-8).toUpperCase();
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  // Build PDF buffer for attachment
  let pdfBuffer = null;
  try {
    const { buildPdfBuffer } = require("./invoice.service");
    pdfBuffer = await buildPdfBuffer(order, customer);
  } catch (e) {
    console.error("PDF generation for order placed email failed:", e.message);
  }

  const productListHtml = (order.products || []).map((item) => {
    const name = item.title || "Elite Item";
    const price = Number(item.price || 0).toFixed(2);
    const qty = item.quantity || 1;
    return `
      <tr style="border-bottom: 1px solid #eeeeee;">
        <td style="padding: 12px 0; color: #000000; font-size: 13px; font-weight: 500;">${name}</td>
        <td style="padding: 12px 0; color: #000000; font-size: 13px; text-align: center;">${qty}</td>
        <td style="padding: 12px 0; color: #000000; font-size: 13px; text-align: right;">₹${price}</td>
      </tr>
    `;
  }).join("");

  const commonHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #f6f6f6; font-family: 'Helvetica', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f6; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #eeeeee;">
              <tr>
                <td style="padding: 40px; text-align: center; border-bottom: 4px solid #000000;">
                  <h1 style="margin: 0; color: #000000; font-size: 24px; letter-spacing: 6px; text-transform: uppercase; font-weight: 900;">DOLLER COACH</h1>
                  <p style="margin: 5px 0 0; color: #999999; font-size: 10px; letter-spacing: 3px; text-transform: uppercase;">Engineered for Tomorrow</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 15px; color: #999999; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Order Confirmation</p>
                  <h2 style="margin: 0 0 10px; color: #000000; font-size: 32px; font-weight: 900; line-height: 1;">RECEIPT</h2>
                  <p style="margin: 0 0 30px; color: #666666; font-size: 14px; line-height: 1.6;">A new order <strong>#${orderRef}</strong> has been successfully registered in the system.</p>
                  
                  <div style="border-top: 2px solid #000000; padding-top: 30px; margin-bottom: 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <thead>
                        <tr>
                          <th align="left" style="padding-bottom: 12px; color: #999999; font-size: 10px; text-transform: uppercase;">Manifest</th>
                          <th align="center" style="padding-bottom: 12px; color: #999999; font-size: 10px; text-transform: uppercase;">Qty</th>
                          <th align="right" style="padding-bottom: 12px; color: #999999; font-size: 10px; text-transform: uppercase;">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${productListHtml}
                      </tbody>
                    </table>
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 40px;">
                    <tr>
                      <td style="color: #999999; font-size: 14px;">Total Valuation</td>
                      <td align="right" style="color: #000000; font-size: 20px; font-weight: 900;">₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  </table>

                  <div style="text-align: center;">
                    <a href="${clientUrl}/profile" style="background-color: #000000; color: #ffffff; padding: 20px 40px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; display: inline-block;">TRACK JOURNEY</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #000000; padding: 30px; text-align: center;">
                  <p style="margin: 0; color: #ffffff; font-size: 10px; letter-spacing: 1px;">CONFIRMATION ID: ${orderId.toUpperCase()}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Email to Admins
  await safeSend(() =>
    sendEmail({
      to: admins,
      subject: `[New Order] #${orderRef} - Doller Coach`,
      html: commonHtml.replace("Order Confirmation", "New Order Inbound"),
    })
  );

  // Email to Customer
  if (customer?.email) {
    await safeSend(() =>
      sendEmail({
        to: customer.email,
        subject: `Order Recieved - #${orderRef} - Doller Coach`,
        html: commonHtml,
        attachments: pdfBuffer ? [{
          filename: `invoice-${orderRef}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }] : []
      })
    );
  }
}

async function sendOrderPaidConfirmation({ order, customer, invoiceUrl }) {
  if (!customer?.email) return;
  await safeSend(() =>
    sendEmail({
      to: customer.email,
      subject: `Payment confirmed — order ${order._id}`,
      text: `Hi ${customer.name || "there"},\n\nYour payment was received.\nOrder: ${order._id}\n${invoiceUrl ? `Invoice: ${invoiceUrl}\n` : ""}`,
      html: `<p>Hi ${customer.name || "there"},</p><p>Your payment was received.</p><p>Order: ${order._id}</p>${
        invoiceUrl ? `<p><a href="${invoiceUrl}">Download invoice</a></p>` : ""
      }`,
    })
  );
}

async function sendOrderPaidConfirmationWithAttachment({ order, customer, pdfBuffer }) {
  if (!customer?.email) return;
  await safeSend(() =>
    sendEmail({
      to: customer.email,
      subject: "Order Confirmed + Invoice",
      text: `Hi ${customer.name || "there"},\n\nYour payment was confirmed.\nOrder: ${order._id}\n\nYour invoice is attached.`,
      html: `<p>Hi ${customer.name || "there"},</p><p>Your payment was confirmed.</p><p>Order: <strong>${order._id}</strong></p><p>Your invoice is attached to this email.</p>`,
      attachments: pdfBuffer
        ? [{ filename: "invoice.pdf", content: pdfBuffer, contentType: "application/pdf" }]
        : [],
    })
  );
}

async function broadcastNewProductEmail({ product }) {
  const users = await User.find({ role: "user", email: { $exists: true, $nin: [null, ""] } })
    .select("email")
    .lean();
  const emails = users.map((u) => u.email).filter(Boolean);
  if (!emails.length) return;

  const title = product.title || "Elite Arrival";
  const desc = product.shortDescription || product.description || "A masterclass in precision and aesthetic dominance.";
  const price = product.price ? `₹${Number(product.price).toLocaleString("en-IN")}` : "";
  const imageUrl = product.image || product.images?.[0] || getFallback(product.category);
  const productUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/product/${product._id}`;

  const luxuryHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;-webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
              <!-- Header -->
              <tr>
                <td style="padding: 60px 40px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #000000; font-size: 22px; letter-spacing: 12px; text-transform: uppercase; font-weight: 900; line-height: 1;">DOLLER COACH</h1>
                  <div style="height: 1px; width: 40px; background-color: #000000; margin: 25px auto 0;"></div>
                </td>
              </tr>

              <!-- Hero Image -->
              <tr>
                <td style="padding: 0 40px;">
                  <a href="${productUrl}" style="text-decoration: none;">
                    <img src="${imageUrl}" alt="${title}" width="520" style="width: 100%; max-width: 520px; display: block; border: 1px solid #f0f0f0;" />
                  </a>
                </td>
              </tr>

              <!-- Product Info -->
              <tr>
                <td style="padding: 40px 40px 60px;">
                  <p style="margin: 0 0 10px; color: #999999; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 4px; text-align: center;">New Arrival</p>
                  <h2 style="margin: 0 0 20px; color: #000000; font-size: 32px; font-weight: 900; text-align: center; letter-spacing: -1px; line-height: 1.1;">${title.toUpperCase()}</h2>
                  
                  <div style="max-width: 440px; margin: 0 auto;">
                    <p style="margin: 0 0 30px; color: #666666; font-size: 15px; line-height: 1.8; text-align: center; font-weight: 400;">
                      ${desc}
                    </p>
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <div style="margin-bottom: 35px;">
                          <span style="color: #000000; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${price}</span>
                        </div>
                        <a href="${productUrl}" style="background-color: #000000; color: #ffffff; padding: 22px 50px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; display: inline-block; transition: all 0.3s ease;">
                          SHOP THE COLLECTION
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #000000; padding: 60px 40px; text-align: center;">
                  <p style="margin: 0 0 20px; color: #ffffff; font-size: 10px; letter-spacing: 5px; text-transform: uppercase; font-weight: 900;">Precision. Power. Prestige.</p>
                  <div style="height: 1px; width: 30px; background-color: rgba(255,255,255,0.2); margin: 0 auto 20px;"></div>
                  <p style="margin: 0; color: #666666; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;">© ${new Date().getFullYear()} DOLLER COACH GLOBAL. ALL RIGHTS RESERVED.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const chunkSize = 40;
  const relay = process.env.EMAIL_USER || emails[0];
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    await safeSend(() =>
      sendEmail({
        to: relay,
        bcc: chunk,
        subject: `Elite Series: ${title.toUpperCase()} is Here`,
        text: `DOLLER COACH | ${title}\n\n${desc}\n\nInvestment: ${price}\n\nShop Now: ${productUrl}`,
        html: luxuryHtml,
      })
    );
  }
}

async function broadcastOfferEmail({ offer }) {
  const users = await User.find({ role: "user", email: { $exists: true, $nin: [null, ""] } })
    .select("email")
    .lean();
  const emails = users.map((u) => u.email).filter(Boolean);
  if (!emails.length) return;

  const title = offer.title || "Exclusive Elite Access";
  const desc = offer.description || "An invitation to experience the pinnacle of performance luxury.";
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  const luxuryOfferHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;-webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #f0f0f0;">
              <!-- Header -->
              <tr>
                <td style="padding: 60px 40px 40px; text-align: center;">
                  <p style="margin: 0 0 10px; color: #999999; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 4px;">Private Invitation</p>
                  <h1 style="margin: 0; color: #000000; font-size: 22px; letter-spacing: 12px; text-transform: uppercase; font-weight: 900; line-height: 1;">DOLLER COACH</h1>
                  <div style="height: 1px; width: 40px; background-color: #000000; margin: 25px auto 0;"></div>
                </td>
              </tr>

              <!-- Offer Content -->
              <tr>
                <td style="padding: 40px; text-align: center; background-color: #000000;">
                  <h2 style="margin: 0 0 15px; color: #ffffff; font-size: 36px; font-weight: 900; letter-spacing: -1px; line-height: 1;">${title.toUpperCase()}</h2>
                  <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">Limited Time Privilege</p>
                </td>
              </tr>

              <tr>
                <td style="padding: 60px 50px; text-align: center;">
                  <p style="margin: 0 0 40px; color: #666666; font-size: 16px; line-height: 1.8; font-weight: 400;">
                    ${desc}
                  </p>
                  
                  <a href="${clientUrl}/collection" style="background-color: #000000; color: #ffffff; padding: 22px 50px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; display: inline-block;">
                    CLAIM PRIVILEGE
                  </a>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9f9f9; padding: 40px; text-align: center;">
                   <p style="margin: 0 0 15px; color: #000000; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; font-weight: 900;">Precision. Power. Prestige.</p>
                  <p style="margin: 0; color: #999999; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;">© ${new Date().getFullYear()} DOLLER COACH GLOBAL. ALL RIGHTS RESERVED.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const chunkSize = 40;
  const relay = process.env.EMAIL_USER || emails[0];
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    await safeSend(() =>
      sendEmail({
        to: relay,
        bcc: chunk,
        subject: `Privilege Unlocked: ${title}`,
        text: `DOLLER COACH | ${title}\n\n${desc}\n\nClaim Now: ${clientUrl}/collection`,
        html: luxuryOfferHtml,
      })
    );
  }
}

async function sendOrderStatusEmail({ order, customer }) {
  if (!customer?.email) return;

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const status = (order.status || "updated").toUpperCase();
  const orderId = String(order._id);
  
  // Luxury B&W Theme Colors
  const black = "#000000";
  const white = "#ffffff";
  const gray = "#f6f6f6";
  const border = "#eeeeee";

  const productListHtml = (order.products || []).map((item) => {
    const p = item.productId || {};
    const name = p.title || p.name || "Product Item";
    const price = Number(item.price || 0).toFixed(2);
    const qty = item.quantity || 1;

    return `
      <tr style="border-bottom: 1px solid ${border};">
        <td style="padding: 15px 0; color: ${black}; font-size: 14px; font-weight: 500;">${name}</td>
        <td style="padding: 15px 0; color: ${black}; font-size: 14px; text-align: center;">${qty}</td>
        <td style="padding: 15px 0; color: ${black}; font-size: 14px; text-align: right;">₹${price}</td>
      </tr>
    `;
  }).join("");

  // Build PDF buffer for attachment
  let pdfBuffer = null;
  try {
    const { buildPdfBuffer } = require("./invoice.service");
    pdfBuffer = await buildPdfBuffer(order, customer);
  } catch (e) {
    console.error("PDF generation for email failed:", e.message);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: ${gray}; font-family: 'Helvetica', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${gray}; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${white}; border: 1px solid ${border}; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
              <tr>
                <td style="padding: 40px; text-align: center; border-bottom: 4px solid ${black};">
                  <h1 style="margin: 0; color: ${black}; font-size: 24px; letter-spacing: 6px; text-transform: uppercase; font-weight: 900;">DOLLER COACH</h1>
                  <p style="margin: 5px 0 0; color: #999999; font-size: 10px; letter-spacing: 3px; text-transform: uppercase;">Performance Luxury</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 15px; color: #999999; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Order Status Update</p>
                  <h2 style="margin: 0 0 10px; color: ${black}; font-size: 36px; font-weight: 900; line-height: 1; letter-spacing: -1px;">${status}</h2>
                  <p style="margin: 0 0 32px; color: #666666; font-size: 14px; line-height: 1.6;">Hi ${customer.name || "there"}, your order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has entered the ${status} phase.</p>
                  
                  <div style="border-top: 1px solid ${black}; padding-top: 30px; margin-bottom: 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <thead>
                        <tr>
                          <th align="left" style="padding-bottom: 15px; color: #999999; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Item</th>
                          <th align="center" style="padding-bottom: 15px; color: #999999; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Qty</th>
                          <th align="right" style="padding-bottom: 15px; color: #999999; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${productListHtml}
                      </tbody>
                    </table>
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 40px;">
                    <tr>
                      <td style="color: #999999; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Grand Total</td>
                      <td align="right" style="color: ${black}; font-size: 20px; font-weight: 900;">₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  </table>

                  <div style="text-align: center;">
                    <a href="${clientUrl}/profile" style="background-color: ${black}; color: ${white}; padding: 18px 36px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; display: inline-block;">TRACK ORDER</a>
                    <p style="margin: 20px 0 0; color: #999999; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">A professional Tax Invoice is attached for your records.</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #fafafa; padding: 30px; text-align: center; border-top: 1px solid ${border};">
                  <p style="margin: 0; color: #cccccc; font-size: 10px; letter-spacing: 1px;">© ${new Date().getFullYear()} DOLLER COACH GLOBAL</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await safeSend(() =>
    sendEmail({
      to: customer.email,
      subject: `Order Update: ${status} - Order #${orderId.slice(-8).toUpperCase()}`,
      html,
      attachments: pdfBuffer ? [
        {
          filename: `invoice-${orderId.slice(-8).toUpperCase()}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ] : []
    })
  );
}

module.exports = {
  sendOrderPlacedEmails,
  sendOrderPaidConfirmation,
  sendOrderPaidConfirmationWithAttachment,
  broadcastNewProductEmail,
  broadcastOfferEmail,
  sendOrderStatusEmail,
  resolveAdminEmails,
};
