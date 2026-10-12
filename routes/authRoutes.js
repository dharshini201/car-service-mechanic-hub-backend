const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimitMiddleware");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many authentication attempts. Please try again after 15 minutes.",
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset requests. Please try again after 15 minutes.",
});

router.post("/register", authLimiter, registerUser);

router.post("/login", authLimiter, loginUser);

router.get("/me", protect, getCurrentUser);

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);

router.post("/reset-password/:token", authLimiter, resetPassword);
router.post("/reset-password", authLimiter, resetPassword);

module.exports = router;