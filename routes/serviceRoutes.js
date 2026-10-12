const express = require("express");

const {
  getServices,
  getServiceById,
  addService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// ================= SERVICE ROUTES =================

// Get all services
router.get("/", getServices);

// Get single service
router.get("/:serviceId", getServiceById);

// Add service - Admin only
router.post(
  "/",
  protect,
  adminOnly,
  addService
);

// Update service - Admin only
router.put(
  "/:serviceId",
  protect,
  adminOnly,
  updateService
);

// Delete service - Admin only
router.delete(
  "/:serviceId",
  protect,
  adminOnly,
  deleteService
);

module.exports = router;