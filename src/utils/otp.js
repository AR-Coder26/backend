const crypto = require('crypto');

const OTP_DIGITS = 6;
const OTP_UPPER_BOUND_EXCLUSIVE = 1000000; // 0 - 999999 -> 10^6 keyspace for a 6-digit code

// Generates a cryptographically secure 6-digit numeric OTP as a zero-padded string ("000482").
// crypto.randomInt is a CSPRNG (unlike Math.random, which is NOT safe for security tokens),
// and randomInt's range is uniform with no modulo bias.
const generateOtp = () => {
  const otp = crypto.randomInt(0, OTP_UPPER_BOUND_EXCLUSIVE);
  return String(otp).padStart(OTP_DIGITS, '0');
};

// A plain SHA-256 hash of a 6-digit number is trivially rainbow-tabled offline (only 10^6
// possibilities) if the database ever leaks. HMAC-SHA256 with a server-only secret ("pepper").
const getOtpPepper = () => {
  const pepper = process.env.OTP_HASH_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!process.env.OTP_HASH_SECRET) {
    console.warn(
      '[security] OTP_HASH_SECRET is not set - falling back to JWT_ACCESS_SECRET. ' +
        'Set a dedicated OTP_HASH_SECRET in .env for production.'
    );
  }
  return pepper;
};

const hashOtp = (otp) => crypto.createHmac('sha256', getOtpPepper()).update(String(otp)).digest('hex');

// Constant-time comparison so response timing can't be used to infer partial hash matches.
const compareOtp = (candidateOtp, storedHash) => {
  if (!storedHash) return false;
  const candidateHash = hashOtp(candidateOtp);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// Opaque, high-entropy (256-bit) token for the "OTP verified, now set a new password" step.
// Only its bcrypt hash is ever persisted - mirrors how refreshTokenHash is handled on the User
// model, so a raw, usable secret never sits in the database.
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

module.exports = { generateOtp, hashOtp, compareOtp, generateResetToken };