const Notification = require("../models/Notification");

const sendNotification = async (
  userId,
  title,
  message,
  type = "info"
) => {
  try {
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
    });

    return notification;
  } catch (error) {
    console.error(
      "Send Notification Error:",
      error.message
    );

    return null;
  }
};

module.exports = sendNotification;