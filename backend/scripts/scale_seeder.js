const pLimit = require("p-limit");
const limit = pLimit(10); // concurrency control

const ORDER_STATUS = ["placed", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUS = ["PENDING", "PAID", "FAILED"];

function generateOrder(prod, user) {
    const subtotal = prod.price || 999;
    const discount = Math.random() > 0.7 ? 100 : 0;
    const gst = Math.round(subtotal * 0.18);
    const delivery = Math.random() > 0.5 ? 50 : 0;

    return {
        userId: user._id,
        products: [{
            productId: prod._id,
            title: prod.name,
            quantity: 1,
            price: subtotal
        }],
        subtotal,
        discount,
        gst,
        delivery,
        total: subtotal - discount + gst + delivery,
        status: ORDER_STATUS[Math.floor(Math.random() * ORDER_STATUS.length)],
        paymentStatus: PAYMENT_STATUS[Math.floor(Math.random() * PAYMENT_STATUS.length)],
        shippingAddress: {
            phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
            addressLine1: "Scale Street",
            city: "TestCity",
            pincode: "110001"
        }
    };
}