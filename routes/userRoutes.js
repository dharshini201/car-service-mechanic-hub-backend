const express = require("express");

const {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  deleteUser,
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// ================= USER PROFILE =================

// Get logged-in user's profile
router.get("/profile", protect, getUserProfile);

// Update logged-in user's profile
router.put("/profile", protect, updateUserProfile);

// ================= ADMIN USER MANAGEMENT =================

// Get all users
router.get(
  "/",
  protect,
  adminOnly,
  getAllUsers
);

// Delete user
router.delete(
  "/:userId",
  protect,
  adminOnly,
  deleteUser
);

module.exports = router;