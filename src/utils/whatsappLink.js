
// Converts any accepted phone format (0300..., +92300...) into the digits-only, no-plus
// format required by wa.me links (e.g. 923001234567).
const { BRAND_LINE } = require('./branding');
const toWhatsAppFormat = (phone) => {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+92')) return trimmed.slice(1);
  if (trimmed.startsWith('0')) return `92${trimmed.slice(1)}`;
  if (trimmed.startsWith('92')) return trimmed;
  return trimmed;
};

const STATUS_MESSAGES = {
  Pending: (order) =>
    `Dear Valuable Customer ${order.customer.name}, we've received your order ${order.orderNumber}. We'll call you shortly to confirm it - please don't mistake it for spam. Thank you!\n\n${BRAND_LINE}`,
  Confirmed: (order) =>
    `Your order ${order.orderNumber} has been confirmed! Total: Rs. ${order.pricing.totalAmount}. We'll notify you once it ships.`,
  Shipped: (order) =>
    `Good news! Your order ${order.orderNumber} has been shipped and is on its way.`,
  Delivered: (order) =>
    `Your order ${order.orderNumber} has been delivered. Thank you for shopping with us!`,
  Cancelled: (order) =>
    `Your order ${order.orderNumber} has been cancelled.${order.cancelReason ? ` Reason: ${order.cancelReason}` : ''}`,
};

const buildOrderStatusMessage = (order, status) => {
  const builder = STATUS_MESSAGES[status] || STATUS_MESSAGES.Pending;
  return builder(order);
};

// Generates a wa.me link pre-filled with a status-appropriate message. This is a link the ADMIN
// clicks to open WhatsApp with the message ready to send to the CUSTOMER - it does NOT push a
// notification to the admin's own phone (that would require a paid WhatsApp Business API).
const generateOrderWhatsAppLink = (order, status = order.orderStatus) => {
  const waPhone = toWhatsAppFormat(order.customer.whatsappNumber || order.customer.phone);
  if (!waPhone) return null;
  const message = buildOrderStatusMessage(order, status);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
};

module.exports = { toWhatsAppFormat, buildOrderStatusMessage, generateOrderWhatsAppLink };