const createRateLimiter = ({ windowMs, max, keyFn }) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key =
      (typeof keyFn === "function" ? keyFn(req) : null) ||
      `${req.ip}:${req.method}:${req.path}`;

    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
      });
    }

    return next();
  };
};

module.exports = { createRateLimiter };
