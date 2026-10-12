/**
 * In-memory sliding-window rate limiter middleware.
 * Designed for lightweight, dependency-free endpoint protection.
 */
const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 50, message = "Too many requests, please try again later." } = {}) => {
  const requests = new Map();

  // Periodically clean up expired records
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requests.entries()) {
      if (now - data.startTime > windowMs) {
        requests.delete(ip);
      }
    }
  }, 60 * 1000).unref(); // unref so it does not keep process alive

  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    const record = requests.get(ip);

    if (!record) {
      requests.set(ip, { count: 1, startTime: now });
      return next();
    }

    if (now - record.startTime > windowMs) {
      // Window expired, reset counter
      record.count = 1;
      record.startTime = now;
      return next();
    }

    record.count += 1;

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((windowMs - (now - record.startTime)) / 1000),
      });
    }

    next();
  };
};

module.exports = rateLimit;
