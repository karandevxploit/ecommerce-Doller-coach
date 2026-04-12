const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const cloudinary = require("../config/cloudinary");
const companyConfig = require("../config/companyConfig");
const Config = require("../models/config.model");

/**
 * PROFESSIONAL CORPORATE INVOICE GENERATOR (BLACK & WHITE)
 * Replaces all previous designs with a fresh, printable high-fidelity layout.
 */
async function buildPdfBuffer(order, customer) {
  const config = (await Config.findOne().lean()) || companyConfig;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        info: { Title: `Tax Invoice - ${order.invoiceNumber || order._id}`, Author: "DOLLER Coach" }
      });

      const buffers = [];
      doc.on("data", (data) => buffers.push(data));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // DESIGN SYSTEM
      const BLACK = "#000000";
      const BORDER_LIGHT = "#F2F2F2";
      const BORDER_DARK = "#000000";
      const FONT_REG = "Helvetica";
      const FONT_BOLD = "Helvetica-Bold";

      let y = 60;

      // --- 1. HEADER SECTION ---
      // Logo (Left)
      if (config.logo) {
        try { doc.image(config.logo, 50, y, { width: 65 }); } catch (e) {}
      }
      doc.fillColor(BLACK).fontSize(14).font(FONT_BOLD).text("DOLLER COACH", 50, y + 75);
      doc.fontSize(8).font(FONT_REG).fillColor("#6B7280").text("(By Gangwani and Company)", 50, y + 92);

      // Title (Right)
      doc.fontSize(32).font(FONT_BOLD).text("INVOICE", 400, y - 5, { align: "right", width: 145 });

      // Divider Line
      y = 155;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER_LIGHT).lineWidth(1).stroke();

      // --- 2. COMPANY & INVOICE META GRID ---
      y += 20;
      const metaY = y;
      
      // LEFT Column: Company details
      doc.fillColor(BLACK).fontSize(10).font(FONT_BOLD).text("Phone:", 50, y);
      doc.font(FONT_REG).text(config.phone || "9690668290", 88, y);
      
      doc.font(FONT_BOLD).text("Email:", 50, y + 18);
      doc.font(FONT_REG).text(config.email || "dollercoach@mail.com", 88, y + 18);
      
      doc.font(FONT_BOLD).text("GST Number:", 50, y + 36);
      doc.font(FONT_REG).text(config.gst || "09BVKC3260JJZE", 118, y + 36);

      // RIGHT Column: Invoice metadata
      const labelX = 360;
      const valueX = 450;
      doc.font(FONT_BOLD).text("Invoice No:", labelX, metaY, { width: 90 });
      doc.font(FONT_REG).text(order.invoiceNumber || `INV-${String(order._id).slice(-8).toUpperCase()}`, valueX, metaY, { width: 95, align: "right" });

      doc.font(FONT_BOLD).text("Order ID:", labelX, metaY + 18, { width: 90 });
      doc.font(FONT_REG).text(`#${String(order._id).slice(-6).toUpperCase()}`, valueX, metaY + 18, { width: 95, align: "right" });

      doc.font(FONT_BOLD).text("Invoice Date:", labelX, metaY + 36, { width: 90 });
      const iDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : "--";
      doc.font(FONT_REG).text(iDate, valueX, metaY + 36, { width: 95, align: "right" });

      // Divider Line
      y += 65;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER_LIGHT).stroke();

      // --- 3. CUSTOMER BLOCK ---
      y += 20;
      doc.font(FONT_BOLD).fontSize(12).text(order.shippingAddress?.name || customer?.name || "CUSTOMER NAME", 50, y);
      doc.font(FONT_REG).fontSize(10).fillColor("#4B5563");
      
      const displayPhone = order.shippingAddress?.phone || customer?.phone || "N/A";
      doc.text(`Phone: ${displayPhone}`, 50, y + 18);
      doc.text(`Email: ${customer?.email || "N/A"}`, 50, y + 32);
      doc.text("Address:", 50, y + 46);
      
      let displayAddress = order.address || "Shipping address pending";
      if (order.shippingAddress?.address) {
        const { address, city, state, pincode } = order.shippingAddress;
        displayAddress = `${address}, ${city}, ${state} - ${pincode}`;
      }
      doc.text(displayAddress, 50, y + 60, { width: 280, lineGap: 3 });

      // Divider Line
      y += 110;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER_LIGHT).stroke();

      // --- 4. PRODUCT TABLE ---
      y += 15;
      doc.fillColor(BLACK).font(FONT_BOLD).fontSize(10);
      doc.text("Product", 50, y);
      doc.text("Quantity", 280, y, { align: "center", width: 50 });
      doc.text("Price", 350, y, { align: "right", width: 85 });
      doc.text("Total", 460, y, { align: "right", width: 85 });

      y += 22;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER_DARK).lineWidth(0.5).stroke();
      y += 15;

      const products = order.products || [];
      products.forEach((item) => {
        const title = item.title || item.productId?.title || "Product Item";
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const total = qty * price;

        // Specialized Size Display Logic
        let sizeInfo = "";
        if (item.topSize && item.bottomSize) {
          sizeInfo = ` [Size: ${item.topSize}(T) / ${item.bottomSize}(B)]`;
        } else if (item.size) {
          sizeInfo = ` [Size: ${item.size}]`;
        }

        doc.font(FONT_REG).fontSize(10).fillColor(BLACK);
        const displayTitle = title + sizeInfo;
        const textH = doc.heightOfString(displayTitle, { width: 220 });

        doc.text(displayTitle, 50, y, { width: 220 });
        doc.text(qty.toString(), 280, y, { align: "center", width: 50 });
        doc.text(`₹ ${price.toFixed(2)}`, 350, y, { align: "right", width: 85 });
        doc.text(`₹ ${total.toFixed(2)}`, 460, y, { align: "right", width: 85 });

        y += Math.max(30, textH + 15);
        doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER_LIGHT).lineWidth(0.5).stroke();
        y += 15;
      });

      // --- 5. SUMMARY BLOCK ---
      y += 10;
      const sX = 350;
      const vX = 460;

      const drawRow = (lbl, val, bold = false) => {
        doc.font(bold ? FONT_BOLD : FONT_REG).fontSize(10).text(lbl, sX, y, { align: "right", width: 100 });
        doc.text(`₹ ${Number(val).toFixed(2)}`, vX, y, { align: "right", width: 85 });
        y += 22;
      };

      const gstDisplay = Math.round((order.subtotal || 0) * 0.18);
      const totalDisplay = (order.subtotal || 0) - (order.discount || 0) + gstDisplay;

      drawRow("Subtotal:", order.subtotal || 0);
      drawRow(`GST (18%):`, gstDisplay);
      drawRow("Shipping:", 0); // Enforced FREE Everywhere
      
      y += 5;
      doc.moveTo(sX + 20, y).lineTo(545, y).strokeColor(BORDER_DARK).lineWidth(0.5).stroke();
      y += 12;
      drawRow("Grand Total:", totalDisplay, true);

      // --- 6. PAYMENT & QR ---
      y += 30;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(BORDER_LIGHT).lineWidth(0.5).stroke();
      y += 20;

      const baseFooterY = y;
      doc.font(FONT_BOLD).fontSize(10).text("Payment Method:", 50, y);
      doc.font(FONT_REG).text(order.paymentMethod?.toUpperCase() || "COD", 150, y);

      doc.font(FONT_BOLD).text("Payment Status:", 50, y + 18);
      doc.font(FONT_REG).text(order.paymentStatus?.toUpperCase() || "PAID", 150, y + 18);

      // QR Placement
      try {
        const qrUrl = `https://dollercoach.com/order/${order._id}`;
        const qrImg = await QRCode.toBuffer(qrUrl, { margin: 1, width: 80 });
        doc.image(qrImg, 465, baseFooterY - 10, { width: 80 });
        doc.font(FONT_REG).fontSize(8).text("Scan for Order Details", 465, baseFooterY + 75, { align: "center", width: 80 });
      } catch (e) {}

      // --- 7. FINAL LEGAL FOOTER ---
      const footY = 765;
      doc.moveTo(50, footY).lineTo(545, footY).strokeColor(BORDER_LIGHT).stroke();
      doc.font(FONT_BOLD).fontSize(11).text("Thank you for shopping with DOLLER Coach", 50, footY + 15, { align: "center", width: 495 });
      doc.font(FONT_REG).fontSize(8).fillColor("#9CA3AF").text("(By Gangwani and Company)", 50, footY + 30, { align: "center", width: 495 });
      doc.font(FONT_REG).fontSize(8).text("Terms & Conditions Apply.", 50, footY + 32, { align: "center", width: 495 });

      doc.end();
    } catch (err) {
      console.error("PDF BUILD ERROR:", err);
      reject(err);
    }
  });
}

/**
 * Unified generation and upload logic.
 */
async function generateAndUploadInvoice(order, customer) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return { url: "", publicId: "" };
  try {
    const buffer = await buildPdfBuffer(order, customer);
    const b64 = buffer.toString("base64");
    const dataUri = `data:application/pdf;base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "invoices",
      resource_type: "raw",
      public_id: `invoice_${String(order._id)}`,
      overwrite: true,
    });
    return { url: result.secure_url || "", publicId: result.public_id || "" };
  } catch (err) {
    console.error("Invoice Upload Error:", err);
    return { url: "", publicId: "" };
  }
}

module.exports = { generateAndUploadInvoice, buildPdfBuffer };
