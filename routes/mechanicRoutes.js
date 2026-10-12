const express = require("express");

const {
  mechanicLogin,
  getMechanicProfile,
  updateMechanicProfile,
  getMechanics,
  getMechanicById,
  addMechanic,
  updateMechanic,
  deleteMechanic,
  getPendingOffers,
  acceptServiceOffer,
  rejectServiceOffer,
  getAssignedServices,
  getAssignedBookingById,
  updateServiceStatus,
  getMechanicDashboard,
} = require("../controllers/mechanicController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const mechanicOnly = require("../middleware/mechanicMiddleware");
const rateLimit = require("../middleware/rateLimitMiddleware");

const mechanicLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many mechanic login attempts. Please try again after 15 minutes.",
});

const router = express.Router();

// ================= PUBLIC MECHANIC AUTH =================
// Mechanic dedicated login
router.post("/login", mechanicLoginLimiter, mechanicLogin);

// ================= MECHANIC PORTAL (PROTECTED) =================
// Mechanic profile
router.get("/profile", protect, mechanicOnly, getMechanicProfile);
router.put("/profile", protect, mechanicOnly, updateMechanicProfile);

// Get mechanic dashboard statistics
router.get("/dashboard", protect, mechanicOnly, getMechanicDashboard);

// Pending assignment offers (Accept / Reject)
router.get("/offers", protect, mechanicOnly, getPendingOffers);
router.put("/offers/:bookingId/accept", protect, mechanicOnly, acceptServiceOffer);
router.post("/offers/:bookingId/accept", protect, mechanicOnly, acceptServiceOffer);
router.put("/offers/:bookingId/reject", protect, mechanicOnly, rejectServiceOffer);
router.post("/offers/:bookingId/reject", protect, mechanicOnly, rejectServiceOffer);

// Get assigned services / bookings (Accepted tasks)
router.get("/assigned-services", protect, mechanicOnly, getAssignedServices);
router.get("/bookings", protect, mechanicOnly, getAssignedServices);

// Get single assigned booking details
router.get("/bookings/:bookingId", protect, mechanicOnly, getAssignedBookingById);
router.get("/service/:serviceId", protect, mechanicOnly, getAssignedBookingById);
router.get("/request/:requestId", protect, mechanicOnly, getAssignedBookingById);

// Update assigned service status
router.put("/service/:serviceId/status", protect, mechanicOnly, updateServiceStatus);
router.put("/bookings/:bookingId/status", protect, mechanicOnly, updateServiceStatus);

// ================= ADMIN: MECHANIC MANAGEMENT =================
// Get all mechanics with workload & assignments
router.get("/", protect, adminOnly, getMechanics);

// Get mechanic by ID
router.get("/:mechanicId", protect, adminOnly, getMechanicById);

// Add new mechanic
router.post("/", protect, adminOnly, addMechanic);

// Update mechanic
router.put("/:mechanicId", protect, adminOnly, updateMechanic);

// Delete mechanic
router.delete("/:mechanicId", protect, adminOnly, deleteMechanic);

module.exports = router;