const Vehicle = require("../models/Vehicle");
const sendEmail = require("../utils/sendEmail");

// ================= GET ALL VEHICLES =================
const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error("Get Vehicles Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching vehicles.",
    });
  }
};

// ================= GET VEHICLE BY ID =================
const getVehicleById = async (req, res) => {
  try {
    const query =
      req.user.role === "admin"
        ? { _id: req.params.vehicleId }
        : { _id: req.params.vehicleId, user: req.user._id };

    const vehicle = await Vehicle.findOne(query);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    res.status(200).json({
      success: true,
      vehicle,
    });
  } catch (error) {
    console.error("Get Vehicle Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching vehicle.",
    });
  }
};

// ================= ADD VEHICLE =================
const addVehicle = async (req, res) => {
  try {
    const {
      brand,
      model,
      vehicleNumber,
      year,
      fuelType,
    } = req.body;

    if (
      !brand ||
      !model ||
      !vehicleNumber ||
      !year ||
      !fuelType
    ) {
      return res.status(400).json({
        success: false,
        message: "All vehicle fields are required.",
      });
    }

    const normalizedVehicleNumber =
      vehicleNumber.trim().toUpperCase();

    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: normalizedVehicleNumber,
    });

    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number already exists.",
      });
    }

    const vehicle = await Vehicle.create({
      user: req.user._id,
      brand: brand.trim(),
      model: model.trim(),
      vehicleNumber: normalizedVehicleNumber,
      year,
      fuelType,
    });

    // Send vehicle registration email notification
    try {
      if (req.user && req.user.email) {
        await sendEmail({
          to: req.user.email,
          subject: "Vehicle Registered Successfully - MRT Car Service",
          recipientName: req.user.name,
          heading: "Vehicle Registered Successfully",
          intro: "Your vehicle has been successfully registered with MRT Car Service.",
          details: [
            { label: "Brand", value: vehicle.brand },
            { label: "Model", value: vehicle.model },
            { label: "Vehicle Number", value: vehicle.vehicleNumber },
            { label: "Year", value: vehicle.year },
            { label: "Fuel Type", value: vehicle.fuelType },
          ],
          actionNote: "You can now use this vehicle to book our services.",
          text: `Dear ${req.user.name},\n\nYour vehicle has been successfully registered with MRT Car Service.\n\nVehicle Details:\nBrand: ${vehicle.brand}\nModel: ${vehicle.model}\nVehicle Number: ${vehicle.vehicleNumber}\nYear: ${vehicle.year}\nFuel Type: ${vehicle.fuelType}\n\nYou can now use this vehicle to book our services.\n\nThank you,\nMRT Car Service`,
        });
      }
    } catch (emailError) {
      console.error("Email Error:", emailError.message);
    }

    res.status(201).json({
      success: true,
      message: "Vehicle added successfully.",
      vehicle,
    });
  } catch (error) {
    console.error("Add Vehicle Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while adding vehicle.",
    });
  }
};

// ================= UPDATE VEHICLE =================
const updateVehicle = async (req, res) => {
  try {
    const query =
      req.user.role === "admin"
        ? { _id: req.params.vehicleId }
        : { _id: req.params.vehicleId, user: req.user._id };

    const vehicle = await Vehicle.findOne(query);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    const {
      brand,
      model,
      vehicleNumber,
      year,
      fuelType,
    } = req.body;

    if (brand) {
      vehicle.brand = brand.trim();
    }

    if (model) {
      vehicle.model = model.trim();
    }

    if (vehicleNumber) {
      const normalizedVehicleNumber =
        vehicleNumber.trim().toUpperCase();

      const existingVehicle = await Vehicle.findOne({
        vehicleNumber: normalizedVehicleNumber,
        _id: { $ne: vehicle._id },
      });

      if (existingVehicle) {
        return res.status(400).json({
          success: false,
          message: "Vehicle number already exists.",
        });
      }

      vehicle.vehicleNumber = normalizedVehicleNumber;
    }

    if (year) {
      vehicle.year = year;
    }

    if (fuelType) {
      vehicle.fuelType = fuelType;
    }

    const updatedVehicle = await vehicle.save();

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully.",
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error("Update Vehicle Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating vehicle.",
    });
  }
};

// ================= DELETE VEHICLE =================
const deleteVehicle = async (req, res) => {
  try {
    const query =
      req.user.role === "admin"
        ? { _id: req.params.vehicleId }
        : { _id: req.params.vehicleId, user: req.user._id };

    const vehicle = await Vehicle.findOne(query);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    await Vehicle.findByIdAndDelete(vehicle._id);

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Vehicle Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting vehicle.",
    });
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  addVehicle,
  updateVehicle,
  deleteVehicle,
};