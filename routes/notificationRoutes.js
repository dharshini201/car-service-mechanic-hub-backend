const express = require("express");

const {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
} = require("../controllers/notificationController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// ================= NOTIFICATION ROUTES =================

// Get logged-in user's notifications
router.get(
  "/",
  protect,
  getNotifications
);

// Create notification - Admin only
router.post(
  "/",
  protect,
  adminOnly,
  createNotification
);

// Mark one notification as read
router.put(
  "/:notificationId/read",
  protect,
  markAsRead
);

// Mark all notifications as read
router.put(
  "/read-all",
  protect,
  markAllAsRead
);

// Delete one notification
router.delete(
  "/:notificationId",
  protect,
  deleteNotification
);

// Clear all notifications
router.delete(
  "/clear-all",
  protect,
  clearNotifications
);

module.exports = router;