// backend/src/middleware/honeypot.middleware.js
const SecurityLog = require('../models/SecurityLog.model');

const honeypotCheck = async (req, res, next) => {
  const honeypotValue = req.body?.honeypot;

  if (honeypotValue && String(honeypotValue).trim().length > 0) {
    req.isHoneypotTriggered = true;

    try {
      await SecurityLog.create({
        event: 'HONEYPOT_TRIGGERED',
        email: (req.body?.email || '').toLowerCase().trim() || undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        meta: { path: req.originalUrl, honeypotValue: String(honeypotValue).slice(0, 100) },
      });
    } catch (err) {
      console.error('Failed to write honeypot SecurityLog entry:', err.message);
    }
  }

  next();
};

module.exports = honeypotCheck;