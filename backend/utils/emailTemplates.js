const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const button = (label, href) => `
  <a href="${escapeHtml(href)}"
     style="display:inline-block;background:#050505;color:#fff;text-decoration:none;
     padding:14px 22px;border-radius:10px;font-weight:800;letter-spacing:.08em;
     text-transform:uppercase;font-size:12px;">
    ${escapeHtml(label)}
  </a>
`;

const baseTemplate = ({ title, preview, content }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview || title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:26px 30px;background:#050505;color:#fff;">
                <div style="font-size:22px;font-weight:900;letter-spacing:-.03em;">DOLLER COACH</div>
                <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#cbd5e1;margin-top:4px;">Premium Fashion Store</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px;background:#fafafa;color:#6b7280;font-size:12px;line-height:1.6;">
                Doller Coach<br />
                This is an automated email. Please do not reply to this message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const otpEmail = ({ name, otp, minutes = 10 }) =>
  baseTemplate({
    title: "Verify your Doller Coach email",
    preview: `Your verification code is ${otp}`,
    content: `
      <h1 style="margin:0 0 10px;font-size:28px;letter-spacing:-.04em;">Verify your email</h1>
      <p style="margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.7;">
        Hi ${escapeHtml(name || "there")}, use this 6-digit code to finish creating your Doller Coach account.
      </p>
      <div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:16px;padding:24px;text-align:center;margin:22px 0;">
        <div style="font-size:40px;letter-spacing:.28em;font-weight:900;color:#050505;">${escapeHtml(otp)}</div>
      </div>
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.7;">
        This code expires in ${Number(minutes) || 10} minutes. If you did not request this, you can safely ignore this email.
      </p>
    `,
  });

const orderAdminEmail = ({ order = {}, customer = {} }) => {
  const items = Array.isArray(order.products) ? order.products : [];
  const address = order.shippingAddress || {};

  return baseTemplate({
    title: "New order received",
    preview: `New order ${order.invoiceNumber || order._id || ""} received`,
    content: `
      <h1 style="margin:0 0 10px;font-size:28px;letter-spacing:-.04em;">New order received</h1>
      <p style="margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.7;">
        A customer has placed a new order. Please review and confirm it from the admin panel.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:18px 0;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:12px 14px;background:#f9fafb;font-weight:700;">Order ID</td><td style="padding:12px 14px;">${escapeHtml(order.invoiceNumber || order._id || "N/A")}</td></tr>
        <tr><td style="padding:12px 14px;background:#f9fafb;font-weight:700;">Customer</td><td style="padding:12px 14px;">${escapeHtml(customer.name || address.fullName || "Customer")}</td></tr>
        <tr><td style="padding:12px 14px;background:#f9fafb;font-weight:700;">Phone</td><td style="padding:12px 14px;">${escapeHtml(address.phone || "N/A")}</td></tr>
        <tr><td style="padding:12px 14px;background:#f9fafb;font-weight:700;">Payment</td><td style="padding:12px 14px;">${escapeHtml(order.paymentMethod || "N/A")}</td></tr>
        <tr><td style="padding:12px 14px;background:#f9fafb;font-weight:700;">Total</td><td style="padding:12px 14px;font-weight:900;">${formatCurrency(order.total)}</td></tr>
      </table>
      <h2 style="font-size:16px;margin:24px 0 12px;">Items</h2>
      <div style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        ${items
          .map(
            (item) => `
              <div style="padding:14px;border-bottom:1px solid #e5e7eb;">
                <strong>${escapeHtml(item.title || "Product")}</strong>
                <div style="color:#6b7280;font-size:13px;margin-top:5px;">
                  Qty ${Number(item.quantity) || 1} · ${escapeHtml(item.size || item.topSize || "")}
                  ${item.color ? ` · ${escapeHtml(item.color)}` : ""}
                </div>
              </div>`
          )
          .join("")}
      </div>
    `,
  });
};

const productAnnouncementEmail = ({ product = {}, shopUrl = "" }) =>
  baseTemplate({
    title: `${product.name || product.title || "New product"} is now live`,
    preview: "A new Doller Coach product just dropped",
    content: `
      <h1 style="margin:0 0 10px;font-size:28px;letter-spacing:-.04em;">New drop is live</h1>
      <p style="margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.7;">
        ${escapeHtml(product.name || product.title || "A new product")} has just been added to Doller Coach.
      </p>
      ${
        product.primaryImage || product.image
          ? `<img src="${escapeHtml(product.primaryImage || product.image)}" alt="${escapeHtml(product.name || "Product")}" style="width:100%;max-height:360px;object-fit:cover;border-radius:18px;border:1px solid #e5e7eb;margin:8px 0 22px;" />`
          : ""
      }
      <div style="font-size:24px;font-weight:900;margin-bottom:20px;">${formatCurrency(product.price)}</div>
      ${shopUrl ? button("Shop Now", shopUrl) : ""}
    `,
  });

module.exports = {
  otpEmail,
  orderAdminEmail,
  productAnnouncementEmail,
};
