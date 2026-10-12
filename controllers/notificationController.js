const Notification = require("../models/Notification");

// ================= GET NOTIFICATIONS =================
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead
    ).length;

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching notifications.",
    });
  }
};

// ================= CREATE NOTIFICATION =================
const createNotification = async (req, res) => {
  try {
    const {
      user,
      title,
      message,
      type,
    } = req.body;

    if (!user || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "User, title and message are required.",
      });
    }

    const notification = await Notification.create({
      user,
      title: title.trim(),
      message: message.trim(),
      type: type || "info",
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully.",
      notification,
    });
  } catch (error) {
    console.error("Create Notification Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while creating notification.",
    });
  }
};

// ================= MARK AS READ =================
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.notificationId,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    notification.isRead = true;

    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    console.error("Mark Notification Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating notification.",
    });
  }
};

// ================= MARK ALL AS READ =================
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Mark All Notifications Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while updating notifications.",
    });
  }
};

// ================= DELETE NOTIFICATION =================
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.notificationId,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    await Notification.findByIdAndDelete(
      notification._id
    );

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Notification Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while deleting notification.",
    });
  }
};

// ================= CLEAR ALL NOTIFICATIONS =================
const clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({
      user: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "All notifications cleared successfully.",
    });
  } catch (error) {
    console.error("Clear Notifications Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while clearing notifications.",
    });
  }
};

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
};