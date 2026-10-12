const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");
const User = require("../models/User");
const Mechanic = require("../models/Mechanic");
const ServiceHistory = require("../models/ServiceHistory");
const sendNotification = require("../utils/sendNotification");
const sendEmail = require("../utils/sendEmail");
const {
  sendBookingConfirmationEmail,
  sendBookingStatusEmail,
  sendVehicleReadyEmail,
} = require("../services/emailService");
const { assignNextEligibleMechanic } = require("../services/assignmentService");

// ================= GET BOOKINGS =================
const getBookings = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "customer") {
      filter.customer = req.user._id;
    } else if (req.user.role === "mechanic") {
      filter.mechanic = req.user._id;
    }

    const bookings = await Booking.find(filter)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone")
      .populate("assignedMechanic", "name email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get Bookings Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching bookings.",
    });
  }
};

// ================= GET BOOKING BY ID =================
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone")
      .populate("assignedMechanic", "name email phone");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // Customer can view only own booking
    if (
      req.user.role === "customer" &&
      booking.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // Mechanic can view only assigned booking
    if (
      req.user.role === "mechanic" &&
      (!booking.mechanic ||
        booking.mechanic._id.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const bookingObj = booking.toObject();

    res.status(200).json({
      success: true,
      booking: bookingObj,
    });
  } catch (error) {
    console.error("Get Booking Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching booking.",
    });
  }
};

// ================= CREATE BOOKING =================
const createBooking = async (req, res) => {
  try {
    const {
      vehicle,
      service,
      bookingDate,
      bookingTime,
      description,
    } = req.body;

    if (
      !vehicle ||
      !service ||
      !bookingDate ||
      !bookingTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Vehicle, service, booking date and booking time are required.",
      });
    }

    // Check vehicle belongs to customer (or any valid vehicle if created by Admin)
    const isAdmin = req.user.role === "admin";
    const customerVehicle = isAdmin
      ? await Vehicle.findById(vehicle)
      : await Vehicle.findOne({ _id: vehicle, user: req.user._id });

    if (!customerVehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found or access denied.",
      });
    }

    const targetCustomerId = isAdmin
      ? req.body.customer || customerVehicle.user || req.user._id
      : req.user._id;

    // Check service exists and is active
    const selectedService = await Service.findOne({
      _id: service,
      isActive: true,
    });

    if (!selectedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found or inactive.",
      });
    }

    // Generate unique booking ID
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const bookingId = `BK-${randomSuffix}`;

    // Step 1: Save booking in MongoDB FIRST
    const booking = await Booking.create({
      bookingId,
      customer: targetCustomerId,
      vehicle,
      vehicleNumber: customerVehicle.vehicleNumber,
      vehicleModel: `${customerVehicle.brand} ${customerVehicle.model}`,
      service,
      serviceType: selectedService.name,
      bookingDate,
      bookingTime,
      description: description || "",
      status: "Pending",
      bookingStatus: "Pending",
      serviceStatus: "Pending",
      emailedStatuses: ["Pending"],
      statusHistory: [
        {
          status: "Pending",
          changedAt: new Date(),
          changedBy: req.user._id,
          notes: isAdmin ? "Booking created by Administrator" : "Booking submitted by customer",
        },
      ],
    });

    // Step 2: Mechanic assignment
    if (isAdmin && req.body.mechanic) {
      booking.mechanic = req.body.mechanic;
      booking.assignedMechanic = req.body.mechanic;
      booking.assignmentStatus = "Accepted";
      booking.assignmentHistory.push({
        mechanic: req.body.mechanic,
        action: "MANUAL_ASSIGNED",
        assignedBy: "ADMIN",
        timestamp: new Date(),
        notes: "Assigned during booking creation by Administrator",
      });
      await booking.save();
    } else {
      // Automatically offer booking to eligible mechanic with lowest active workload
      try {
        await assignNextEligibleMechanic(booking._id);
      } catch (assignError) {
        console.error("Auto Mechanic Assignment Error:", assignError.message);
      }
    }

    // Step 3: Send customer notification
    await sendNotification(
      targetCustomerId,
      "Booking Confirmed",
      `Your car service booking (${bookingId}) has been successfully created.`,
      "success"
    ).catch(() => {});

    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone")
      .populate("assignedMechanic", "name email phone");

    // Step 4: Automatically send booking confirmation email to customer registered email
    try {
      await sendBookingConfirmationEmail({
        booking: populatedBooking,
        customer: populatedBooking.customer,
        vehicle: populatedBooking.vehicle,
        service: populatedBooking.service,
      });
    } catch (emailError) {
      console.error("Booking Confirmation Email Error:", emailError.message);
    }

    res.status(201).json({
      success: true,
      message: "Service booking created successfully.",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("Create Booking Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while creating booking.",
    });
  }
};

// ================= UPDATE BOOKING =================
const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // Customer can update only own booking
    if (
      req.user.role === "customer" &&
      booking.customer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    // Mechanic can update only assigned and accepted bookings
    if (req.user.role === "mechanic") {
      const isAssigned =
        (booking.mechanic && booking.mechanic.toString() === req.user._id.toString()) ||
        (booking.assignedMechanic && booking.assignedMechanic.toString() === req.user._id.toString());

      if (!isAssigned || booking.assignmentStatus !== "Accepted") {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only update accepted bookings assigned to you.",
        });
      }
    }

    const oldStatus = booking.status;
    const oldMechanic = booking.mechanic ? booking.mechanic.toString() : null;

    const {
      vehicle,
      service,
      bookingDate,
      bookingTime,
      description,
      mechanic,
      status,
      serviceStatus,
      mechanicNotes,
    } = req.body;

    // Only customer or admin can edit vehicle details
    if (vehicle !== undefined && req.user.role !== "mechanic") {
      const customerVehicle = await Vehicle.findOne({
        _id: vehicle,
        user: booking.customer,
      });

      if (!customerVehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found.",
        });
      }

      booking.vehicle = vehicle;
      booking.vehicleNumber = customerVehicle.vehicleNumber;
      booking.vehicleModel = `${customerVehicle.brand} ${customerVehicle.model}`;
    }

    // Only customer or admin can edit service details
    if (service !== undefined && req.user.role !== "mechanic") {
      const selectedService = await Service.findOne({
        _id: service,
        isActive: true,
      });

      if (!selectedService) {
        return res.status(404).json({
          success: false,
          message: "Service not found or inactive.",
        });
      }

      booking.service = service;
      booking.serviceType = selectedService.name;
    }

    if (bookingDate !== undefined && req.user.role !== "mechanic") {
      booking.bookingDate = bookingDate;
    }

    if (bookingTime !== undefined && req.user.role !== "mechanic") {
      booking.bookingTime = bookingTime.trim();
    }

    if (description !== undefined && req.user.role !== "mechanic") {
      booking.description = description.trim();
    }

    // Admin can assign/reassign mechanic
    let mechanicChanged = false;
    if (mechanic !== undefined && req.user.role === "admin") {
      if (mechanic === null || mechanic === "" || mechanic === "none") {
        booking.mechanic = null;
        booking.assignedMechanic = null;
        booking.assignmentStatus = "Unassigned";
        if (oldMechanic) {
          mechanicChanged = true;
          booking.assignmentHistory.push({
            action: "REASSIGNED",
            assignedBy: "ADMIN",
            timestamp: new Date(),
            notes: "Mechanic unassigned by admin",
          });
        }
      } else {
        // Resolve mechanic: could be User ID or Mechanic Doc ID
        let mechanicUser = await User.findOne({
          _id: mechanic,
          role: "mechanic",
          isActive: true,
        });

        if (!mechanicUser) {
          const mechDoc = await Mechanic.findById(mechanic).populate("user");
          if (mechDoc && mechDoc.user) {
            mechanicUser = mechDoc.user;
          }
        }

        if (!mechanicUser) {
          return res.status(404).json({
            success: false,
            message: "Mechanic not found or inactive.",
          });
        }

        if (oldMechanic !== mechanicUser._id.toString()) {
          mechanicChanged = true;
        }

        booking.mechanic = mechanicUser._id;
        booking.assignedMechanic = mechanicUser._id;
        booking.assignmentStatus = "Accepted"; // Admin manual override assigns directly
        booking.assignmentHistory.push({
          mechanic: mechanicUser._id,
          action: "MANUAL_ASSIGNED",
          assignedBy: "ADMIN",
          timestamp: new Date(),
          notes: "Manually assigned by Administrator",
        });
      }
    }

    // Determine target status
    const targetStatus = status || serviceStatus;
    let statusChanged = false;
    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "In Service",
      "In Progress",
      "Completed",
      "Ready for Pickup",
      "Cancelled",
    ];

    if (targetStatus !== undefined && allowedStatuses.includes(targetStatus)) {
      if (
        req.user.role === "admin" ||
        req.user.role === "mechanic"
      ) {
        if (oldStatus !== targetStatus) {
          statusChanged = true;
        }
        booking.status = targetStatus;
        booking.serviceStatus = targetStatus;
        booking.bookingStatus = targetStatus;
      }
    }

    if (
      mechanicNotes !== undefined &&
      (req.user.role === "admin" || req.user.role === "mechanic")
    ) {
      booking.mechanicNotes = mechanicNotes.trim();
    }

    if (
      ["Completed", "Ready for Pickup"].includes(booking.status) &&
      !booking.completedAt
    ) {
      booking.completedAt = new Date();
    }

    // Audit trail
    if (statusChanged) {
      booking.statusHistory.push({
        status: booking.status,
        changedAt: new Date(),
        changedBy: req.user._id,
        notes: mechanicNotes || "",
      });
    }

    const updatedBooking = await booking.save();

    const populatedBooking = await Booking.findById(updatedBooking._id)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone")
      .populate("assignedMechanic", "name email phone");

    // Trigger mechanic assignment notifications & emails
    if (mechanicChanged && booking.mechanic && populatedBooking.mechanic) {
      await sendNotification(
        booking.customer,
        "Mechanic Assigned",
        `Mechanic ${populatedBooking.mechanic.name} has been assigned to your booking.`,
        "info"
      );

      await sendNotification(
        booking.mechanic,
        "New Assigned Service",
        "You have been assigned to a new vehicle service booking.",
        "info"
      );

      // Mechanic assignment email
      try {
        if (populatedBooking.customer && populatedBooking.customer.email) {
          await sendEmail({
            to: populatedBooking.customer.email,
            subject: "Mechanic Assigned - MRT Car Service",
            recipientName: populatedBooking.customer.name,
            heading: "Mechanic Assigned",
            intro: "A certified mechanic has been assigned to your vehicle service booking.",
            details: [
              {
                label: "Customer Name",
                value: populatedBooking.customer.name,
              },
              {
                label: "Vehicle",
                value: `${populatedBooking.vehicle?.brand} ${populatedBooking.vehicle?.model} (${populatedBooking.vehicle?.vehicleNumber})`,
              },
              {
                label: "Service",
                value: populatedBooking.service?.name,
              },
              {
                label: "Mechanic Name",
                value: populatedBooking.mechanic.name,
              },
              {
                label: "Booking Date",
                value: new Date(populatedBooking.bookingDate).toLocaleDateString(),
              },
              {
                label: "Booking Time",
                value: populatedBooking.bookingTime,
              },
            ],
            actionNote:
              "Your mechanic is preparing for your appointment. Track updates in your customer dashboard.",
          });
        }
      } catch (emailError) {
        console.error("Assignment Email Error:", emailError.message);
      }
    }

    // Trigger status update notifications & emails (with duplicate protection)
    if (statusChanged) {
      const alreadyEmailed =
        booking.emailedStatuses &&
        booking.emailedStatuses.includes(booking.status);

      if (["Completed", "Ready for Pickup"].includes(booking.status)) {
        // Maintain ServiceHistory record
        const existingHistory = await ServiceHistory.findOne({
          booking: booking._id,
        });

        if (!existingHistory) {
          await ServiceHistory.create({
            customer: booking.customer,
            vehicle: booking.vehicle,
            service: booking.service,
            mechanic: booking.mechanic,
            booking: booking._id,
            serviceDate: new Date(),
            description: booking.description,
            notes: booking.mechanicNotes || "",
            status: "Completed",
          });
        } else {
          existingHistory.notes = booking.mechanicNotes || existingHistory.notes;
          await existingHistory.save();
        }
      }

      await sendNotification(
        booking.customer,
        booking.status === "Ready for Pickup"
          ? "Your Car is Ready for Pickup!"
          : `Service Status: ${booking.status}`,
        booking.status === "Ready for Pickup"
          ? "Your car service has been completed and your vehicle is ready for pickup."
          : `Your service booking is now ${booking.status}.`,
        booking.status === "Ready for Pickup" || booking.status === "Completed"
          ? "success"
          : "info"
      );

      // Email dispatch if not already emailed for this status
      if (!alreadyEmailed) {
        try {
          if (booking.status === "Ready for Pickup") {
            await sendVehicleReadyEmail({
              booking: populatedBooking,
              customer: populatedBooking.customer,
              vehicle: populatedBooking.vehicle,
              service: populatedBooking.service,
              mechanicNotes: populatedBooking.mechanicNotes,
            });
          } else {
            await sendBookingStatusEmail({
              booking: populatedBooking,
              customer: populatedBooking.customer,
              vehicle: populatedBooking.vehicle,
              service: populatedBooking.service,
              status: booking.status,
              mechanicNotes: populatedBooking.mechanicNotes,
            });
          }

          if (!booking.emailedStatuses.includes(booking.status)) {
            booking.emailedStatuses.push(booking.status);
            await booking.save();
          }
        } catch (emailErr) {
          console.error("Status Email Error:", emailErr.message);
        }
      } else {
        console.log(
          `ℹ️ [EmailService] Skipping duplicate status email for status: "${booking.status}" on booking ${booking.bookingId}`
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully.",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("Update Booking Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating booking.",
    });
  }
};

// ================= CANCEL BOOKING =================
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (
      req.user.role === "customer" &&
      booking.customer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    if (["Completed", "Ready for Pickup"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Completed booking cannot be cancelled.",
      });
    }

    if (booking.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled.",
      });
    }

    booking.status = "Cancelled";
    booking.serviceStatus = "Cancelled";
    booking.bookingStatus = "Cancelled";
    booking.statusHistory.push({
      status: "Cancelled",
      changedAt: new Date(),
      changedBy: req.user._id,
      notes: "Booking cancelled",
    });

    const updatedBooking = await booking.save();

    const populatedBooking = await Booking.findById(updatedBooking._id)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone")
      .populate("assignedMechanic", "name email phone");

    await sendNotification(
      booking.customer,
      "Booking Cancelled",
      "Your service booking has been cancelled.",
      "warning"
    );

    if (booking.mechanic) {
      await sendNotification(
        booking.mechanic,
        "Booking Cancelled",
        "An assigned service booking has been cancelled.",
        "warning"
      );
    }

    // Send cancelled email if not already sent
    if (!booking.emailedStatuses.includes("Cancelled")) {
      try {
        if (populatedBooking.customer && populatedBooking.customer.email) {
          await sendEmail({
            to: populatedBooking.customer.email,
            subject: "Service Booking Cancelled - MRT Car Service",
            recipientName: populatedBooking.customer.name,
            heading: "Service Booking Cancelled",
            intro: "Your vehicle service booking has been cancelled.",
            details: [
              {
                label: "Customer Name",
                value: populatedBooking.customer.name,
              },
              {
                label: "Vehicle",
                value: `${populatedBooking.vehicle?.brand} ${populatedBooking.vehicle?.model} (${populatedBooking.vehicle?.vehicleNumber})`,
              },
              {
                label: "Service",
                value: populatedBooking.service?.name,
              },
              {
                label: "Original Booking Date",
                value: new Date(populatedBooking.bookingDate).toLocaleDateString(),
              },
              {
                label: "Original Booking Time",
                value: populatedBooking.bookingTime,
              },
              {
                label: "Status",
                value: "Cancelled",
              },
            ],
            actionNote:
              "You can schedule a new service appointment anytime from your customer dashboard.",
          });

          booking.emailedStatuses.push("Cancelled");
          await booking.save();
        }
      } catch (emailError) {
        console.error("Cancel Email Error:", emailError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("Cancel Booking Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while cancelling booking.",
    });
  }
};

// ================= DELETE BOOKING =================
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    await Booking.findByIdAndDelete(req.params.bookingId);

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Booking Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting booking.",
    });
  }
};

// ================= GET SERVICE HISTORY =================
const getServiceHistory = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "customer") {
      filter.customer = req.user._id;
    } else if (req.user.role === "mechanic") {
      filter.mechanic = req.user._id;
    }

    const history = await ServiceHistory.find(filter)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone")
      .sort({ serviceDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("Get Service History Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching service history.",
    });
  }
};

module.exports = {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
  getServiceHistory,
};