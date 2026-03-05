const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateRegisterPayload = (req, res, next) => {
  const { name, email, password, role } = req.body || {};
  const allowedRoles = ["doctor", "nurse", "patient", "caregiver"];

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ message: "Invalid name" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  return next();
};

const validateLoginPayload = (req, res, next) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ message: "Password is required" });
  }

  return next();
};

module.exports = {
  validateRegisterPayload,
  validateLoginPayload,
};
