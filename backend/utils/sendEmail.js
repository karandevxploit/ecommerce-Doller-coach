const nodemailer = require("nodemailer");
const User = require("../models/user.model");
const logger = require("./logger");

/**
 * Centered professional mail transporter
 */
const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER || process.env.EMAIL,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    },
  });
};

const LOGO_URL = "https://res.cloudinary.com/dollercoach/image/upload/v1/logo/main_logo.png"; // Placeholder/Example
const BRAND_COLOR = "#000000";
const SECONDARY_COLOR = "#999999";

const MEN_FALLBACK = "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800&auto=format&fit=crop";
const WOMEN_FALLBACK = "https://images.unsplash.com/photo-1539109132381-381005a4c8f5?q=80&w=800&auto=format&fit=crop";

const getFallback = (cat) => (String(cat).toUpperCase() === "WOMEN" ? WOMEN_FALLBACK : MEN_FALLBACK);

/**
 * 2. ORDER PLACED → ADMIN MAIL
 */
exports.sendOrderToAdmin = async (order) => {
  try {
    const transporter = getTransporter();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.EMAIL;
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    if (!adminEmail) return;

    const itemsHtml = (order.products || []).map(item => `
      <tr style="border-bottom: 1px solid #eeeeee;">
        <td style="padding: 12px 0; color: #000000; font-size: 14px;">${item.title || "Product"}</td>
        <td style="padding: 12px 0; color: #000000; font-size: 14px; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 12px 0; color: #000000; font-size: 14px; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
      </tr>
    `).join("");

    const mailOptions = {
      from: `"DOLLER Coach" <${process.env.EMAIL_USER || process.env.EMAIL}>`,
      to: adminEmail,
      subject: "🛒 New Order Received",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; color: ${BRAND_COLOR}; letter-spacing: 5px;">DOLLER COACH</h1>
            <p style="color: ${SECONDARY_COLOR}; font-size: 10px; text-transform: uppercase; margin-top: 5px;">(By Gangwani and Company)</p>
          </div>
          <h2 style="color: ${BRAND_COLOR}; border-bottom: 2px solid ${BRAND_COLOR}; padding-bottom: 10px;">New Order Inbound</h2>
          <p><strong>Order ID:</strong> ${order._id}</p>
          <p><strong>Customer:</strong> ${order.address?.name || "Customer"}</p>
          <p><strong>Payment Status:</strong> <span style="color: ${order.paymentStatus === 'PAID' ? 'green' : 'red'};">${order.paymentStatus}</span></p>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
            <thead>
              <tr style="color: ${SECONDARY_COLOR}; font-size: 12px; text-transform: uppercase;">
                <th align="left" style="padding-bottom: 10px;">Item</th>
                <th align="center" style="padding-bottom: 10px;">Qty</th>
                <th align="right" style="padding-bottom: 10px;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding-top: 20px; font-weight: bold;">Grand Total</td>
                <td align="right" style="padding-top: 20px; font-weight: bold; font-size: 18px;">₹${order.totalAmount.toLocaleString("en-IN")}</td>
              </tr>
            </tfoot>
          </table>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientUrl}/admin/orders/${order._id}" style="background: ${BRAND_COLOR}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px;">Review Order</a>
          </div>
          <p style="text-align: center; font-size: 10px; color: ${SECONDARY_COLOR}; margin-top: 30px;">© ${new Date().getFullYear()} DOLLER COACH GLOBAL<br/><span style="font-size: 8px;">(By Gangwani and Company)</span></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info("[Email] Order notification sent to admin");
  } catch (error) {
    logger.error("[Email Error] sendOrderToAdmin:", error.message);
  }
};

/**
 * 3. ORDER STATUS UPDATE → USER MAIL
 */
exports.sendOrderStatusToUser = async (order) => {
  try {
    const transporter = getTransporter();
    const user = await User.findById(order.userId);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    if (!user || !user.email) return;

    const status = (order.status || "Updated").toUpperCase();
    const products = order.products || [];
    const mainProduct = products[0] || {};
    const productImage = mainProduct.productId?.images?.[0] || mainProduct.images?.[0] || getFallback(mainProduct.productId?.category || mainProduct.category);

    const mailOptions = {
      from: `"DOLLER Coach" <${process.env.EMAIL_USER || process.env.EMAIL}>`,
      to: user.email,
      subject: "📦 Your Order Status Updated",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <div style="text-align: center; margin-bottom: 20px;">
             <h1 style="margin: 0; color: ${BRAND_COLOR}; letter-spacing: 5px;">DOLLER COACH</h1>
             <p style="color: ${SECONDARY_COLOR}; font-size: 10px; text-transform: uppercase; margin-top: 5px;">(By Gangwani and Company)</p>
          </div>
          <h2 style="color: ${BRAND_COLOR}; text-align: center; font-size: 24px; text-transform: uppercase;">${status}</h2>
          <p style="text-align: center;">Hi ${user.name || "there"}, your order <strong>#${String(order._id).slice(-8).toUpperCase()}</strong> has been updated to <strong>${status}</strong>.</p>
          
          <div style="background: #fdfdfd; padding: 20px; text-align: center; border: 1px solid #f0f0f0; margin: 20px 0;">
            <img src="${productImage}" alt="Product" style="width: 200px; max-width: 100%; border-radius: 8px;" />
            <h3 style="margin: 15px 0 5px;">${mainProduct.title || "Elite Series Item"}</h3>
            <p style="color: ${BRAND_COLOR}; font-weight: bold; margin: 0;">₹${order.totalAmount.toLocaleString("en-IN")}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientUrl}/profile" style="background: ${BRAND_COLOR}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Track Order</a>
          </div>

          <p style="text-align: center; font-size: 12px; color: ${SECONDARY_COLOR}; margin-top: 30px;">Thank you for choosing DOLLER Coach.</p>
          <p style="text-align: center; font-size: 10px; color: ${SECONDARY_COLOR};">© ${new Date().getFullYear()} DOLLER COACH GLOBAL<br/><span style="font-size: 8px;">(By Gangwani and Company)</span></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`[Email] Status update sent to user: ${user.email}`);
  } catch (error) {
    logger.error("[Email Error] sendOrderStatusToUser:", error.message);
  }
};

/**
 * 4. NEW PRODUCT ADDED → USER MAIL
 */
exports.sendNewProductEmail = async (product) => {
  try {
    const transporter = getTransporter();
    const users = await User.find({ role: "user", email: { $exists: true, $ne: "" } });
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    if (!users.length) return;

    const emails = users.map(u => u.email).filter(Boolean);
    const productUrl = `${clientUrl}/product/${product._id}`;
    const image = product.images?.[0] || product.image || getFallback(product.category);

    const discountTag = product.discountPrice > 0 ? `
      <div style="background: ${BRAND_COLOR}; color: white; padding: 5px 10px; display: inline-block; font-size: 10px; text-transform: uppercase; margin-bottom: 10px;">
        Special Launch Offer
      </div>
    ` : "";

    const mailOptions = {
      from: `"DOLLER Coach" <${process.env.EMAIL_USER || process.env.EMAIL}>`,
      to: process.env.EMAIL_USER || process.env.EMAIL, // Sent to self, BCC to all users for privacy/efficiency
      bcc: emails,
      subject: "🔥 New Product Just Dropped!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <div style="text-align: center; margin-bottom: 30px;">
             <h1 style="margin: 0; color: ${BRAND_COLOR}; letter-spacing: 5px;">DOLLER COACH</h1>
             <p style="color: ${SECONDARY_COLOR}; font-size: 10px; text-transform: uppercase; margin-top: 5px;">(By Gangwani and Company)</p>
          </div>
          
          <div style="text-align: center;">
            <img src="${image}" alt="${product.title}" style="width: 100%; max-width: 500px; border-radius: 4px;" />
            <div style="padding: 30px 0;">
              ${discountTag}
              <h2 style="margin: 0 0 10px; font-size: 28px; text-transform: uppercase; font-weight: 900; color: ${BRAND_COLOR};">${product.title}</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">${product.shortDescription || "Our latest elite collection has arrived. Engineered for peak performance and aesthetic dominance."}</p>
              
              <div style="margin-bottom: 30px;">
                <span style="font-size: 24px; font-weight: bold; color: ${BRAND_COLOR};">₹${product.price.toLocaleString("en-IN")}</span>
                ${product.discountPrice > 0 ? `<span style="text-decoration: line-through; color: ${SECONDARY_COLOR}; margin-left: 10px;">₹${product.originalPrice.toLocaleString("en-IN")}</span>` : ""}
              </div>

              <a href="${productUrl}" style="background: ${BRAND_COLOR}; color: white; padding: 18px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 14px; letter-spacing: 2px;">Buy Now</a>
            </div>
          </div>

          <div style="background: #000000; color: white; padding: 40px; text-align: center; margin-top: 30px;">
            <p style="margin: 0; font-size: 11px; letter-spacing: 4px; text-transform: uppercase;">Precision. Power. Prestige.</p>
            <div style="height: 1px; width: 40px; background: rgba(255,255,255,0.3); margin: 20px auto;"></div>
            <p style="margin: 0; font-size: 9px; color: #666;">© ${new Date().getFullYear()} DOLLER COACH GLOBAL. ALL RIGHTS RESERVED.<br/>(By Gangwani and Company)</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`[Email] New product broadcast sent to ${emails.length} users`);
  } catch (error) {
    logger.error("[Email Error] sendNewProductEmail:", error.message);
  }
};
