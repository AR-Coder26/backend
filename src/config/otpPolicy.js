module.exports = {
  // Strict 5-minute OTP validity window.
  OTP_EXPIRY_MS: Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000,

  // 3 failed verification attempts triggers a lockout.
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS || 3),

  // 2-hour account lock once the attempt cap is hit.
  OTP_LOCK_DURATION_MS: Number(process.env.OTP_LOCK_DURATION_HOURS || 2) * 60 * 60 * 1000,

  // Minimum time between two OTP requests for the same admin - stops an attacker (or an admin's
  // own retry-happy finger) from resetting the attempt counter by spamming /forgot-password.
  OTP_RESEND_COOLDOWN_MS: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60) * 1000,

  // Short-lived, single-use window for the opaque reset token issued after a correct OTP.
  RESET_TOKEN_EXPIRY_MS: Number(process.env.RESET_TOKEN_EXPIRY_MINUTES || 10) * 60 * 1000,
};