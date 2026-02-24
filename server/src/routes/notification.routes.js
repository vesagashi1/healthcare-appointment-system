const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { isMongoReady } = require("../config/mongo");
const {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../services/notification.service");

const router = express.Router();

router.use(authMiddleware);

router.use((req, res, next) => {
  if (!isMongoReady()) {
    return res.status(503).json({
      message: "Notifications service unavailable (MongoDB not connected)",
    });
  }
  return next();
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const limitRaw = parseInt(req.query.limit, 10);
    const offsetRaw = parseInt(req.query.offset, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
    const read =
      req.query.read === "true" ? true : req.query.read === "false" ? false : undefined;

    const notifications = await listNotifications({
      userId,
      limit,
      offset,
      read,
    });

    return res.json({
      message: "Notifications retrieved successfully",
      notifications,
      count: notifications.length,
    });
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    return res.json({ unread_count: count });
  } catch (err) {
    console.error("GET UNREAD COUNT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const updated = await markNotificationRead({
      userId: req.user.id,
      notificationId: req.params.id,
    });

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("MARK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    const modified = await markAllNotificationsRead(req.user.id);
    return res.json({
      message: "Notifications updated",
      modified_count: modified,
    });
  } catch (err) {
    console.error("MARK ALL NOTIFICATIONS READ ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
