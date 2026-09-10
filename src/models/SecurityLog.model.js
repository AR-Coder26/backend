const mongoose = require('mongoose');

const SECURITY_LOG_EVENTS = [
  'OTP_REQUESTED',
  'OTP_REQUEST_BLOCKED_LOCKED',
  'OTP_REQUEST_COOLDOWN',
  'OTP_REQUEST_UNKNOWN_EMAIL',
  'OTP_VERIFIED',
  'OTP_VERIFY_FAILED',
  'OTP_VERIFY_FAILED_NO_ACTIVE_OTP',
  'OTP_VERIFY_FAILED_UNKNOWN_EMAIL',
  'OTP_VERIFY_BLOCKED_LOCKED',
  'OTP_LOCKOUT_TRIGGERED',
  'RESET_TOKEN_INVALID',
  'RESET_TOKEN_MISMATCH',
  'PASSWORD_RESET_SUCCESS',
  'HONEYPOT_TRIGGERED',
];

const securityLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: SECURITY_LOG_EVENTS,
      required: true,
      index: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Stored even when no matching admin is found, so enumeration attempts against non-existent
    // accounts are still visible in the audit trail.
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Fast lookups for abuse review: "everything for this admin/IP in the last N days"
securityLogSchema.index({ admin: 1, createdAt: -1 });
securityLogSchema.index({ ip: 1, createdAt: -1 });

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);
SecurityLog.EVENTS = SECURITY_LOG_EVENTS;

module.exports = SecurityLog;