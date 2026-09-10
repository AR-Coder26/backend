const TARPIT_DELAY_MS = Number(process.env.OTP_TARPIT_DELAY_MS) || 3000;

const tarpitDelay = () => new Promise((resolve) => setTimeout(resolve, TARPIT_DELAY_MS));

module.exports = { tarpitDelay, TARPIT_DELAY_MS };