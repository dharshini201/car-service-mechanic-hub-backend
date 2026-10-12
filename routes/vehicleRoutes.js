const express = require("express");

const {
  getVehicles,
  getVehicleById,
  addVehicle,
  updateVehicle,
  deleteVehicle,
} = require("../controllers/vehicleController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// ================= VEHICLE ROUTES =================

// Get all vehicles of logged-in customer
router.get("/", protect, getVehicles);

// Get single vehicle
router.get("/:vehicleId", protect, getVehicleById);

// Add vehicle
router.post("/", protect, addVehicle);

// Update vehicle
router.put("/:vehicleId", protect, updateVehicle);

// Delete vehicle
router.delete("/:vehicleId", protect, deleteVehicle);

module.exports = router;