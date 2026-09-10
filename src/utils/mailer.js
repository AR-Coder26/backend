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

const buildOtpEmailBody = (admin, otp) => `
Hi ${admin.name},

Your Admin Panel password reset verification code is:

    ${otp}

This code expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes and can only be used ${process.env.OTP_MAX_ATTEMPTS || 3} times.

If you did not request this, you can safely ignore this email - your account has not been changed.
For your security, never share this code with anyone, including someone claiming to be from support.
`.trim();

// Sends the OTP to the admin's own registered email. Deliberately swallows errors (never break
// the request/response cycle) - the controller always returns the same generic message to the
// caller regardless of whether this actually got delivered, so account existence isn't leaked.
const sendAdminOtpEmail = async (admin, otp) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Admin OTP email skipped: GMAIL_USER/GMAIL_APP_PASSWORD not set in .env');
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"Admin Panel Security" <${process.env.GMAIL_USER}>`,
      to: admin.email,
      subject: 'Your password reset verification code',
      text: buildOtpEmailBody(admin, otp),
    });
  } catch (err) {
    console.error('Failed to send admin OTP email:', err.message);
  }
};

const buildLockoutAlertEmailBody = (admin, { ip, userAgent, at }) => `
Security Alert

The Admin Panel account for ${admin.email} was just locked for 2 hours after 3 failed
password-reset verification attempts.

Time: ${at.toISOString()}
IP address: ${ip}
User-Agent: ${userAgent}

If this wasn't you, no action is needed - the account is already locked and the OTP has been
invalidated. If you were trying to reset your own password, please wait for the lock to expire
before requesting a new code.
`.trim();

// Fires on every lockout event. Sent to the admin's own email AND, if configured, to a separate
// alert inbox (ADMIN_ALERT_EMAIL) - reusing the same env var already used for new-order alerts.
const sendAdminLockoutAlertEmail = async (admin, { ip, userAgent, at }) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Admin lockout alert email skipped: GMAIL_USER/GMAIL_APP_PASSWORD not set in .env');
    return;
  }

  const recipients = [admin.email, process.env.ADMIN_ALERT_EMAIL].filter(Boolean);
  if (recipients.length === 0) return;

  try {
    await getTransporter().sendMail({
      from: `"Admin Panel Security" <${process.env.GMAIL_USER}>`,
      to: recipients.join(', '),
      subject: `Security alert: admin account locked (${admin.email})`,
      text: buildLockoutAlertEmailBody(admin, { ip, userAgent, at }),
    });
  } catch (err) {
    console.error('Failed to send admin lockout alert email:', err.message);
  }
};

const buildPasswordResetConfirmationEmailBody = (admin) => `
Hi ${admin.name},

This confirms your Admin Panel password was just changed via the forgot-password flow.

If you made this change, no action is needed. If you did NOT make this change, your account may
be compromised - contact ARQ-DevTech support immediately.
`.trim();

// Confirmation sent after a successful reset - lets the real owner catch it fast if it wasn't them.
const sendAdminPasswordResetConfirmationEmail = async (admin) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Admin password-reset confirmation email skipped: GMAIL_USER/GMAIL_APP_PASSWORD not set in .env');
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"Admin Panel Security" <${process.env.GMAIL_USER}>`,
      to: admin.email,
      subject: 'Your Admin Panel password was changed',
      text: buildPasswordResetConfirmationEmailBody(admin),
    });
  } catch (err) {
    console.error('Failed to send admin password-reset confirmation email:', err.message);
  }
};

module.exports = {
  sendNewOrderAlertEmail,
  buildOrderEmailBody,
  sendAdminOtpEmail,
  sendAdminLockoutAlertEmail,
  sendAdminPasswordResetConfirmationEmail,
};