const express = require("express");

const {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
  getServiceHistory,
} = require("../controllers/bookingController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// ================= BOOKING ROUTES =================

// Get bookings
// Customer → own bookings
// Mechanic → assigned bookings
router.get("/", protect, getBookings);

// Get service history (must be before /:bookingId)
router.get("/history", protect, getServiceHistory);

// Get single booking
router.get("/:bookingId", protect, getBookingById);

// Create booking - Customer or Admin
router.post(
  "/",
  protect,
  (req, res, next) => {
    if (req.user.role !== "customer" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only customers and administrators can create bookings.",
      });
    }

    next();
  },
  createBooking
);

// Update booking
router.put(
  "/:bookingId",
  protect,
  updateBooking
);

// Cancel booking
router.put(
  "/:bookingId/cancel",
  protect,
  cancelBooking
);

// Delete booking - Admin only
router.delete(
  "/:bookingId",
  protect,
  adminOnly,
  deleteBooking
);

module.exports = router;