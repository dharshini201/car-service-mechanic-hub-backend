const express = require("express");

const {
  getDashboardStats,
  getAllBookings,
  reassignBooking,
  getAllVehicles,
  getAllUsers,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getReports,
  getActivity,
  getEmailStatus,
  sendTestEmail,
} = require("../controllers/adminController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// ==========================================================
// ADMIN DASHBOARD
// ==========================================================

// Get dashboard statistics
router.get(
  "/dashboard",
  protect,
  adminOnly,
  getDashboardStats
);

// ==========================================================
// ADMIN USERS
// ==========================================================

// Get all customer users
router.get(
  "/users",
  protect,
  adminOnly,
  getAllUsers
);

// ==========================================================
// ADMIN BOOKINGS
// ==========================================================

// Get all bookings
router.get(
  "/bookings",
  protect,
  adminOnly,
  getAllBookings
);

// Manually or automatically reassign booking
router.post(
  "/bookings/:bookingId/reassign",
  protect,
  adminOnly,
  reassignBooking
);

// ==========================================================
// ADMIN VEHICLES
// ==========================================================

// Get all vehicles
router.get(
  "/vehicles",
  protect,
  adminOnly,
  getAllVehicles
);

// ==========================================================
// ADMIN CATEGORIES
// ==========================================================

// Get all categories
router.get(
  "/categories",
  protect,
  adminOnly,
  getCategories
);

// Add category
router.post(
  "/categories",
  protect,
  adminOnly,
  addCategory
);

// Update category
router.put(
  "/categories/:categoryId",
  protect,
  adminOnly,
  updateCategory
);

// Delete category
router.delete(
  "/categories/:categoryId",
  protect,
  adminOnly,
  deleteCategory
);

// ==========================================================
// ADMIN REPORTS
// ==========================================================

// Get reports
router.get(
  "/reports",
  protect,
  adminOnly,
  getReports
);

// ==========================================================
// ADMIN ACTIVITY
// ==========================================================

// Get recent activity
router.get(
  "/activity",
  protect,
  adminOnly,
  getActivity
);

// ==========================================================
// EMAIL DIAGNOSTICS & TESTING
// ==========================================================

router.get("/email-status", protect, adminOnly, getEmailStatus);
router.post("/test-email", protect, adminOnly, sendTestEmail);

module.exports = router;

