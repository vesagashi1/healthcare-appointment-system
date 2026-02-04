const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/public", (req, res) => {
  res.json({ message: "API is reachable" });
});

router.get("/protected", authMiddleware, (req, res) => {
  res.json({
    message: "You have access to protected route",
    user: req.user,
  });
});

router.get(
  "/doctor-only",
  authMiddleware,
  requireRole("doctor"),
  (req, res) => {
    res.json({
      message: "Doctor access granted",
      user: req.user,
    });
  },
);

router.get(
  "/patient-only",
  authMiddleware,
  requireRole("patient"),
  (req, res) => {
    res.json({
      message: "Patient access granted",
      user: req.user,
    });
  },
);

module.exports = router;
