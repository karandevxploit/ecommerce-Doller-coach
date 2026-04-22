const checkPageBreak = () => {
  if (y > 700) {
    doc.addPage();
    y = 50;
  }
};

products.forEach((item) => {
  checkPageBreak();

  const title = item.title || "Product";
  const qty = Number(item.quantity || 1);
  const price = Number(item.price || 0);
  const total = qty * price;

  doc.text(title, 50, y, { width: 220 });
  doc.text(qty.toString(), 280, y, { align: "center", width: 50 });
  doc.text(`₹ ${price.toFixed(2)}`, 350, y, { align: "right", width: 85 });
  doc.text(`₹ ${total.toFixed(2)}`, 460, y, { align: "right", width: 85 });

  y += 30;
});