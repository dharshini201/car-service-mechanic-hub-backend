const mongoose = require("mongoose");
const Service = require("../models/Service");

// ================= GET ALL SERVICES =================
const getServices = async (req, res) => {
  try {
    const services = await Service.find()
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error("Get Services Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching services.",
    });
  }
};

// ================= GET SERVICE BY ID =================
const getServiceById = async (req, res) => {
  try {
    let service;

    if (mongoose.Types.ObjectId.isValid(req.params.serviceId)) {
      service = await Service.findById(req.params.serviceId).populate(
        "category",
        "name"
      );
    } else {
      const escapedQuery = req.params.serviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      service = await Service.findOne({
        name: new RegExp(escapedQuery, "i"),
      }).populate("category", "name");
    }

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error("Get Service Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching service.",
    });
  }
};

// ================= ADD SERVICE =================
const addService = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      duration,
      category,
      icon,
    } = req.body;

    if (
      !name ||
      !description ||
      price === undefined ||
      !duration
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, description, price and duration are required.",
      });
    }

    const validCategory =
      category && mongoose.Types.ObjectId.isValid(category)
        ? category
        : null;

    const service = await Service.create({
      name: name.trim(),
      description: description.trim(),
      price,
      duration: duration.trim(),
      category: validCategory,
      icon: icon || "bi-tools",
    });

    const populatedService = await Service.findById(service._id)
      .populate("category", "name");

    res.status(201).json({
      success: true,
      message: "Service added successfully.",
      service: populatedService,
    });
  } catch (error) {
    console.error("Add Service Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while adding service.",
    });
  }
};

// ================= UPDATE SERVICE =================
const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    const {
      name,
      description,
      price,
      duration,
      category,
      icon,
      isActive,
    } = req.body;

    if (name !== undefined) {
      service.name = name.trim();
    }

    if (description !== undefined) {
      service.description = description.trim();
    }

    if (price !== undefined) {
      service.price = price;
    }

    if (duration !== undefined) {
      service.duration = duration.trim();
    }

    if (category !== undefined) {
      service.category =
        category && mongoose.Types.ObjectId.isValid(category)
          ? category
          : null;
    }

    if (icon !== undefined) {
      service.icon = icon;
    }

    if (isActive !== undefined) {
      service.isActive = isActive;
    }

    const updatedService = await service.save();

    const populatedService = await Service.findById(
      updatedService._id
    ).populate("category", "name");

    res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      service: populatedService,
    });
  } catch (error) {
    console.error("Update Service Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating service.",
    });
  }
};

// ================= DELETE SERVICE =================
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    await Service.findByIdAndDelete(req.params.serviceId);

    res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Service Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting service.",
    });
  }
};

module.exports = {
  getServices,
  getServiceById,
  addService,
  updateService,
  deleteService,
};