const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token malformed" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check user still exists and is active
    const userCheck = await pool.query(
      `SELECT id, active FROM users WHERE id = $1`,
      [decoded.id],
    );

    if (userCheck.rowCount === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    if (userCheck.rows[0].active === false) {
      return res.status(403).json({ message: "Account is suspended" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    return res.status(500).json({ message: "Authentication error" });
  }
};

module.exports = authMiddleware;
