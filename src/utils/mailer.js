const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
};

const buildOrderEmailBody = (order) => {
  const itemsList = order.items
    .map((item) => `- ${item.productName} (${item.color}, ${item.size}) x${item.quantity} = Rs. ${item.subtotal}`)
    .join('\n');

  return `
New Order Received!

Order Number: ${order.orderNumber}
Customer: ${order.customer.name}
Phone: ${order.customer.phone}
WhatsApp: ${order.customer.whatsappNumber || order.customer.phone}
Email: ${order.customer.email || 'N/A'}

Shipping Address:
${order.shippingAddress.addressLine}, ${order.shippingAddress.city} ${order.shippingAddress.postalCode || ''}

Items:
${itemsList}

Subtotal: Rs. ${order.pricing.subtotal}
Delivery: Rs. ${order.pricing.deliveryCharge}
Total: Rs. ${order.pricing.totalAmount}

Payment Method: ${order.paymentMethod}

Please log in to the admin dashboard to confirm this order.
  `.trim();
};

// Sends a free email alert to the admin when a new order arrives. Deliberately swallows every
// error internally - a failed email must NEVER break order creation (the order is already saved
// and stock already decremented by the time this runs; the email is a best-effort side notification only).
const sendNewOrderAlertEmail = async (order) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.ADMIN_ALERT_EMAIL) {
    console.warn('New-order email alert skipped: GMAIL_USER/GMAIL_APP_PASSWORD/ADMIN_ALERT_EMAIL not set in .env');
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"Order Alerts" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_ALERT_EMAIL,
      subject: `New Order ${order.orderNumber} - Rs. ${order.pricing.totalAmount}`,
      text: buildOrderEmailBody(order),
    });
  } catch (err) {
    console.error('Failed to send new-order alert email:', err.message);
  }
};

module.exports = { sendNewOrderAlertEmail, buildOrderEmailBody };