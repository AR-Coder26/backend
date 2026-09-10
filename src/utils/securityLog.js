const SecurityLog = require('../models/SecurityLog.model');

// Fire-and-forget audit write.
const logSecurityEvent = async ({ event, admin = null, email = null, ip, userAgent, meta = {} }) => {
  try {
    await SecurityLog.create({
      event,
      admin: admin || null,
      email: email ? String(email).toLowerCase().trim() : null,
      ip,
      userAgent: userAgent || 'unknown',
      meta,
    });
  } catch (err) {
    console.error(`Failed to write SecurityLog entry [${event}]:`, err.message);
  }
};

module.exports = { logSecurityEvent };