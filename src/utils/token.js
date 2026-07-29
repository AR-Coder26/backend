const COOKIE_NAMES = {
  admin: {
    access: 'admin_access_token',
    refresh: 'admin_refresh_token',
  },
  customer: {
    access: 'customer_access_token',
    refresh: 'customer_refresh_token',
  },
};

// Converts a JWT-style duration string ('15m', '7d', '30d', '45s') into milliseconds.
// This is used so the cookie's maxAge always matches the JWT's own expiresIn -
// hardcoding both separately risks them silently drifting apart if you change one in .env later.
const msFromDuration = (duration) => {
  const match = /^(\d+)(s|m|h|d)$/.exec(String(duration).trim());
  if (!match) return 15 * 60 * 1000; // safe fallback: 15 minutes

  const value = Number(match[1]);
  const unit = match[2];
  const unitToMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

  return value * unitToMs[unit];
};

const buildCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // 'lax' works for same-site localhost dev; 'none' is required in production for cross-site
  // frontend/backend domains, but 'none' REQUIRES secure: true or browsers silently reject the cookie
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  // Never set domain to 'localhost' explicitly - some browsers reject it. Only set a domain in production.
  domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
  maxAge,
});

const setAuthCookies = (
  res,
  { accessToken, refreshToken, accessCookieName, refreshCookieName, accessExpiry, refreshExpiry }
) => {
  res.cookie(accessCookieName, accessToken, buildCookieOptions(msFromDuration(accessExpiry)));
  res.cookie(refreshCookieName, refreshToken, buildCookieOptions(msFromDuration(refreshExpiry)));
};

const clearAuthCookies = (res, { accessCookieName, refreshCookieName }) => {
  const options = buildCookieOptions(0);
  res.clearCookie(accessCookieName, options);
  res.clearCookie(refreshCookieName, options);
};

module.exports = {
  COOKIE_NAMES,
  msFromDuration,
  buildCookieOptions,
  setAuthCookies,
  clearAuthCookies,
};