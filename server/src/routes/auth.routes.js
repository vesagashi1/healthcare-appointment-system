const express = require("express");
const { register, login, refresh, logout } = require("../controllers/auth.controller");
const { createRateLimiter } = require("../middlewares/rateLimit.middleware");
const {
  validateRegisterPayload,
  validateLoginPayload,
} = require("../middlewares/validation.middleware");

const router = express.Router();

const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const registerLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });
const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

router.post("/register", registerLimiter, validateRegisterPayload, register);
router.post("/login", loginLimiter, validateLoginPayload, login);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);

module.exports = router;
