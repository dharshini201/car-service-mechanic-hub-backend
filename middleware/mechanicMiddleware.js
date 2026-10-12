const mechanicOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Please login.",
    });
  }

  if (req.user.role !== "mechanic") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Mechanics only.",
    });
  }

  next();
};

module.exports = mechanicOnly;