const Mechanic = require("../models/Mechanic");
const User = require("../models/User");
const Booking = require("../models/Booking");
const ServiceHistory = require("../models/ServiceHistory");
const sendNotification = require("../utils/sendNotification");
const sendEmail = require("../utils/sendEmail");
const {
  sendBookingStatusEmail,
  sendCompletedServiceEmail,
  sendCancelledBookingEmail,
} = sendEmail;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { assignNextEligibleMechanic } = require("../services/assignmentService");

// ================= MECHANIC LOGIN =================
const mechanicLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.role !== "mechanic") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only registered mechanics can login through this portal.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your mechanic account has been deactivated. Please contact the workshop supervisor.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const mechanicProfile = await Mechanic.findOne({ user: user._id });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      success: true,
      message: "Mechanic login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        experience: mechanicProfile?.experience || 0,
        mechanicId: mechanicProfile?._id,
      },
    });
  } catch (error) {
    console.error("Mechanic Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during mechanic login.",
    });
  }
};

// ================= GET MECHANIC PROFILE =================
const getMechanicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Mechanic user record not found.",
      });
    }

    const mechanicProfile = await Mechanic.findOne({ user: user._id });

    // Calculate live workload stats
    const [assignedCount, pendingCount, inServiceCount, completedCount] =
      await Promise.all([
        Booking.countDocuments({
          mechanic: user._id,
          status: { $nin: ["Cancelled"] },
          assignmentStatus: "Accepted",
        }),
        Booking.countDocuments({
          mechanic: user._id,
          assignmentStatus: "Pending Acceptance",
          status: { $nin: ["Cancelled"] },
        }),
        Booking.countDocuments({
          mechanic: user._id,
          assignmentStatus: "Accepted",
          status: { $in: ["In Service", "In Progress"] },
        }),
        Booking.countDocuments({
          mechanic: user._id,
          status: { $in: ["Completed", "Ready for Pickup"] },
        }),
      ]);

    res.status(200).json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        experience: mechanicProfile?.experience || 0,
        isAvailable: mechanicProfile?.isAvailable !== false,
        status: mechanicProfile?.status || "Active",
        mechanicId: mechanicProfile?._id,
        stats: {
          totalAssigned: assignedCount,
          pending: pendingCount,
          inService: inServiceCount,
          completed: completedCount,
        },
      },
    });
  } catch (error) {
    console.error("Get Mechanic Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching mechanic profile.",
    });
  }
};

// ================= UPDATE MECHANIC PROFILE =================
const updateMechanicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Mechanic user record not found.",
      });
    }

    let mechanicProfile = await Mechanic.findOne({ user: user._id });
    if (!mechanicProfile) {
      mechanicProfile = await Mechanic.create({
        user: user._id,
        phone: user.phone,
      });
    }

    const {
      name,
      phone,
      experience,
      isAvailable,
      password,
    } = req.body;

    if (name) user.name = name.trim();
    if (phone) {
      user.phone = phone.trim();
      mechanicProfile.phone = phone.trim();
    }
    if (experience !== undefined) mechanicProfile.experience = Number(experience);
    if (isAvailable !== undefined) mechanicProfile.isAvailable = Boolean(isAvailable);

    if (password && password.length >= 6) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    await mechanicProfile.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        experience: mechanicProfile.experience,
        isAvailable: mechanicProfile.isAvailable,
      },
    });
  } catch (error) {
    console.error("Update Mechanic Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating mechanic profile.",
    });
  }
};

// ================= GET ALL MECHANICS (ADMIN) =================
const getMechanics = async (req, res) => {
  try {
    const mechanics = await Mechanic.find()
      .populate("user", "name email phone role isActive")
      .sort({ createdAt: -1 });

    // Attach active workload and assigned bookings to each mechanic
    const mechanicsWithWorkload = await Promise.all(
      mechanics.map(async (m) => {
        const mObj = m.toObject();
        if (m.user && m.user._id) {
          const [activeCount, completedCount, assignedBookings] = await Promise.all([
            Booking.countDocuments({
              mechanic: m.user._id,
              status: { $in: ["Pending", "Confirmed", "In Service", "In Progress"] },
            }),
            Booking.countDocuments({
              mechanic: m.user._id,
              status: { $in: ["Completed", "Ready for Pickup"] },
            }),
            Booking.find({
              mechanic: m.user._id,
              status: { $nin: ["Cancelled"] },
            })
              .populate("customer", "name email phone")
              .populate("vehicle", "brand model vehicleNumber fuelType")
              .populate("service", "name price duration")
              .sort({ bookingDate: -1 })
              .limit(10),
          ]);

          mObj.activeWorkload = activeCount;
          mObj.completedJobs = completedCount;
          mObj.assignedBookings = assignedBookings;
        } else {
          mObj.activeWorkload = 0;
          mObj.completedJobs = 0;
          mObj.assignedBookings = [];
        }
        return mObj;
      })
    );

    res.status(200).json({
      success: true,
      count: mechanicsWithWorkload.length,
      mechanics: mechanicsWithWorkload,
    });
  } catch (error) {
    console.error("Get Mechanics Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching mechanics.",
    });
  }
};

// ================= GET MECHANIC BY ID =================
const getMechanicById = async (req, res) => {
  try {
    const mechanic = await Mechanic.findById(req.params.mechanicId)
      .populate("user", "name email phone role isActive");

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: "Mechanic not found.",
      });
    }

    const mObj = mechanic.toObject();
    if (mechanic.user) {
      const assignedBookings = await Booking.find({
        mechanic: mechanic.user._id,
      })
        .populate("customer", "name email phone")
        .populate("vehicle", "brand model vehicleNumber fuelType")
        .populate("service", "name price duration")
        .sort({ bookingDate: -1 });

      mObj.assignedBookings = assignedBookings;
      mObj.activeWorkload = assignedBookings.filter((b) =>
        ["Pending", "Confirmed", "In Service", "In Progress"].includes(b.status)
      ).length;
    }

    res.status(200).json({
      success: true,
      mechanic: mObj,
    });
  } catch (error) {
    console.error("Get Mechanic Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching mechanic.",
    });
  }
};

// ================= ADD MECHANIC (ADMIN) =================
const addMechanic = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      experience,
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: "mechanic",
    });

    const mechanic = await Mechanic.create({
      user: user._id,
      experience: experience ? Number(experience) : 0,
      phone: phone.trim(),
      isAvailable: true,
      status: "Active",
    });

    const populatedMechanic = await Mechanic.findById(mechanic._id)
      .populate("user", "name email phone role isActive");

    res.status(201).json({
      success: true,
      message: "Mechanic added successfully.",
      mechanic: populatedMechanic,
    });
  } catch (error) {
    console.error("Add Mechanic Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding mechanic.",
    });
  }
};

// ================= UPDATE MECHANIC (ADMIN) =================
const updateMechanic = async (req, res) => {
  try {
    const mechanic = await Mechanic.findById(req.params.mechanicId);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: "Mechanic not found.",
      });
    }

    const {
      name,
      email,
      phone,
      experience,
      isAvailable,
      status,
      isActive,
    } = req.body;

    const user = await User.findById(mechanic.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Mechanic user account not found.",
      });
    }

    if (name !== undefined) user.name = name.trim();

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use.",
        });
      }

      user.email = normalizedEmail;
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
      mechanic.phone = phone.trim();
    }

    if (experience !== undefined) {
      mechanic.experience = Number(experience);
    }

    if (isAvailable !== undefined) {
      mechanic.isAvailable = Boolean(isAvailable);
    }

    if (status !== undefined) {
      if (!["Active", "Inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mechanic status.",
        });
      }

      mechanic.status = status;
      user.isActive = status === "Active";
    }

    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
      mechanic.status = isActive ? "Active" : "Inactive";
    }

    await user.save();
    await mechanic.save();

    const updatedMechanic = await Mechanic.findById(mechanic._id)
      .populate("user", "name email phone role isActive");

    res.status(200).json({
      success: true,
      message: "Mechanic updated successfully.",
      mechanic: updatedMechanic,
    });
  } catch (error) {
    console.error("Update Mechanic Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating mechanic.",
    });
  }
};

// ================= DELETE MECHANIC (ADMIN) =================
const deleteMechanic = async (req, res) => {
  try {
    const mechanic = await Mechanic.findById(req.params.mechanicId);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: "Mechanic not found.",
      });
    }

    await User.findByIdAndDelete(mechanic.user);
    await Mechanic.findByIdAndDelete(mechanic._id);

    // Remove mechanic assignment from existing bookings
    await Booking.updateMany(
      { mechanic: mechanic.user },
      { $set: { mechanic: null, assignedMechanic: null } }
    );

    res.status(200).json({
      success: true,
      message: "Mechanic deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Mechanic Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting mechanic.",
    });
  }
};

// ================= GET PENDING OFFERS (MECHANIC) =================
const getPendingOffers = async (req, res) => {
  try {
    const offers = await Booking.find({
      $or: [
        { mechanic: req.user._id },
        { assignedMechanic: req.user._id },
      ],
      assignmentStatus: "Pending Acceptance",
      status: { $ne: "Cancelled" },
    })
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (error) {
    console.error("Get Pending Offers Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pending offers.",
    });
  }
};

// ================= ACCEPT SERVICE OFFER (MECHANIC) =================
const acceptServiceOffer = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.params.id;

    if (req.user.role !== "mechanic") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only mechanics can accept offers.",
      });
    }

    // Atomic update: only if offered to this mechanic and pending
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        $or: [
          { mechanic: req.user._id },
          { assignedMechanic: req.user._id },
        ],
        assignmentStatus: "Pending Acceptance",
      },
      {
        $set: {
          assignmentStatus: "Accepted",
        },
        $push: {
          assignmentHistory: {
            mechanic: req.user._id,
            action: "ACCEPTED",
            timestamp: new Date(),
            assignedBy: "MECHANIC",
            notes: "Offer accepted by technician",
          },
        },
      },
      { new: true }
    )
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration icon")
      .populate("mechanic", "name email phone");

    if (!booking) {
      return res.status(409).json({
        success: false,
        message: "This assignment offer is no longer available or was already accepted/reassigned.",
      });
    }

    // Notify customer
    await sendNotification(
      booking.customer?._id || booking.customer,
      "Technician Assigned",
      `Technician ${req.user.name} has accepted your service booking (${booking.bookingId}).`,
      "success"
    ).catch(() => {});

    res.status(200).json({
      success: true,
      message: "Job accepted successfully! It is now in your active work queue.",
      booking,
    });
  } catch (error) {
    console.error("Accept Offer Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while accepting offer.",
    });
  }
};

// ================= REJECT SERVICE OFFER (MECHANIC) =================
const rejectServiceOffer = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.params.id;
    const { reason } = req.body;

    if (req.user.role !== "mechanic") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only mechanics can reject offers.",
      });
    }

    const rejectionReason = reason && reason.trim() ? reason.trim() : "Declined by technician";

    // Concurrency-safe atomic update marking rejected
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        $or: [
          { mechanic: req.user._id },
          { assignedMechanic: req.user._id },
        ],
        assignmentStatus: "Pending Acceptance",
      },
      {
        $set: {
          assignmentStatus: "Rejected",
          mechanic: null,
          assignedMechanic: null,
        },
        $push: {
          rejectionHistory: {
            mechanic: req.user._id,
            reason: rejectionReason,
            rejectedAt: new Date(),
          },
          assignmentHistory: {
            mechanic: req.user._id,
            action: "REJECTED",
            timestamp: new Date(),
            assignedBy: "MECHANIC",
            notes: rejectionReason,
          },
        },
      },
      { new: true }
    );

    if (!booking) {
      return res.status(409).json({
        success: false,
        message: "This offer is no longer pending or has already been processed.",
      });
    }

    // Automatically offer to the next eligible mechanic
    const reassignResult = await assignNextEligibleMechanic(booking._id, [req.user._id]);

    res.status(200).json({
      success: true,
      message: reassignResult.escalated
        ? "Offer rejected. No further mechanics available; booking escalated to workshop manager."
        : "Offer rejected. Job offered automatically to the next available technician.",
      escalated: reassignResult.escalated,
      booking: reassignResult.booking || booking,
    });
  } catch (error) {
    console.error("Reject Offer Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting offer.",
    });
  }
};

// ================= GET ASSIGNED SERVICES / BOOKINGS =================
const getAssignedServices = async (req, res) => {
  try {
    const isMechanic = req.user.role === "mechanic";
    let filter = {};

    if (isMechanic) {
      filter.$or = [
        { mechanic: req.user._id },
        { assignedMechanic: req.user._id },
      ];
      filter.assignmentStatus = "Accepted";
      filter.status = { $ne: "Cancelled" };
    } else if (req.query.mechanic) {
      filter.$or = [
        { mechanic: req.query.mechanic },
        { assignedMechanic: req.query.mechanic },
      ];
    } else {
      // Admin viewing work queue: include all assigned or active bookings
      filter.status = { $ne: "Cancelled" };
    }

    if (req.query.status && req.query.status !== "All") {
      if (req.query.status === "In Progress") {
        filter.status = { $in: ["In Progress", "In Service"] };
      } else {
        filter.status = req.query.status;
      }
    }

    const bookings = await Booking.find(filter)
      .populate("customer", "name email phone")
      .populate(
        "vehicle",
        "brand model vehicleNumber year fuelType"
      )
      .populate(
        "service",
        "name description price duration icon"
      )
      .populate(
        "mechanic",
        "name email phone"
      )
      .sort({ bookingDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get Assigned Services Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching assigned services.",
    });
  }
};

// ================= GET SINGLE ASSIGNED BOOKING BY ID =================
const getAssignedBookingById = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.params.id || req.params.serviceId;

    const booking = await Booking.findById(bookingId)
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

    // Role check: Only assigned mechanic (or admin) can view
    const isAssigned =
      (booking.mechanic && (booking.mechanic._id || booking.mechanic).toString() === req.user._id.toString()) ||
      (booking.assignedMechanic && (booking.assignedMechanic._id || booking.assignedMechanic).toString() === req.user._id.toString());

    if (req.user.role === "mechanic" && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view jobs assigned to you.",
      });
    }

    const bookingObj = booking.toObject();

    res.status(200).json({
      success: true,
      booking: bookingObj,
    });
  } catch (error) {
    console.error("Get Assigned Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching booking details.",
    });
  }
};

// ================= UPDATE SERVICE STATUS =================
const updateServiceStatus = async (req, res) => {
  try {
    const serviceId = req.params.serviceId || req.params.bookingId || req.params.id;
    const { status, mechanicNotes } = req.body;

    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "In Service",
      "In Progress",
      "Completed",
      "Ready for Pickup",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid service status. Allowed statuses: ${allowedStatuses.join(", ")}`,
      });
    }

    const booking = await Booking.findById(serviceId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Service booking not found.",
      });
    }

    // Check authorization: only the assigned mechanic (or admin) can update
    const isAssigned =
      (booking.mechanic && (booking.mechanic._id || booking.mechanic).toString() === req.user._id.toString()) ||
      (booking.assignedMechanic && (booking.assignedMechanic._id || booking.assignedMechanic).toString() === req.user._id.toString());

    if (req.user.role === "mechanic" && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update services assigned to you.",
      });
    }

    // Require offer to be accepted before updating progress
    if (booking.assignmentStatus !== "Accepted") {
      return res.status(400).json({
        success: false,
        message: "You must accept the assignment offer before updating service progress.",
      });
    }

    // Prevent completed jobs from being reverted
    if (booking.status === "Completed" && status !== "Completed" && status !== "Ready for Pickup") {
      return res.status(400).json({
        success: false,
        message: "Completed jobs cannot be reverted to earlier states.",
      });
    }

    const oldStatus = booking.status;
    const statusChanged = oldStatus !== status;

    // Check duplicate email prevention
    const alreadyEmailed =
      booking.emailedStatuses && booking.emailedStatuses.includes(status);

    booking.status = status;
    booking.serviceStatus = status;
    booking.bookingStatus = status;

    if (mechanicNotes !== undefined) {
      booking.mechanicNotes = mechanicNotes.trim();
    }

    if (["Completed", "Ready for Pickup"].includes(status) && !booking.completedAt) {
      booking.completedAt = new Date();
    }

    // Record audit trail in statusHistory
    if (statusChanged) {
      if (!Array.isArray(booking.statusHistory)) {
        booking.statusHistory = [];
      }
      booking.statusHistory.push({
        status,
        changedAt: new Date(),
        changedBy: req.user._id,
        notes: mechanicNotes ? mechanicNotes.trim() : "",
      });
    }

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration")
      .populate("mechanic", "name email phone");

    // Maintain ServiceHistory record when completed or ready for pickup
    if (["Completed", "Ready for Pickup"].includes(status)) {
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

    // Push notification to customer
    if (statusChanged) {
      await sendNotification(
        booking.customer,
        status === "Completed"
          ? "Service Completed"
          : status === "Ready for Pickup"
          ? "Your Car is Ready for Pickup!"
          : `Service Status: ${status}`,
        status === "Completed"
          ? "Your vehicle service has been completed by the technician."
          : status === "Ready for Pickup"
          ? "Your vehicle service is finished and ready for pickup."
          : `Your service booking status is now: ${status}.`,
        status === "Ready for Pickup" || status === "Completed" ? "success" : "info"
      );
    }

    // Trigger status email if not already sent for this specific status
    if (statusChanged && !alreadyEmailed) {
      try {
        if (status === "Completed") {
          await sendCompletedServiceEmail({
            to: populatedBooking.customer?.email,
            customerName: populatedBooking.customer?.name,
            vehicle: populatedBooking.vehicle,
            service: populatedBooking.service,
            serviceDate: populatedBooking.completedAt || new Date(),
            mechanicName: populatedBooking.mechanic?.name,
            mechanicNotes: populatedBooking.mechanicNotes,
            booking: populatedBooking,
          });
        } else if (status === "Cancelled") {
          await sendCancelledBookingEmail({
            to: populatedBooking.customer?.email,
            customerName: populatedBooking.customer?.name,
            vehicle: populatedBooking.vehicle,
            service: populatedBooking.service,
            bookingDate: populatedBooking.bookingDate,
            bookingTime: populatedBooking.bookingTime,
            status: "Cancelled",
            booking: populatedBooking,
          });
        } else {
          await sendBookingStatusEmail({
            to: populatedBooking.customer?.email,
            customerName: populatedBooking.customer?.name,
            vehicle: populatedBooking.vehicle,
            service: populatedBooking.service,
            status,
            mechanicNotes: populatedBooking.mechanicNotes,
            booking: populatedBooking,
          });
        }

        if (!booking.emailedStatuses.includes(status)) {
          booking.emailedStatuses.push(status);
          await booking.save();
        }
      } catch (emailErr) {
        console.error("Email Error:", emailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Service status updated to ${status} successfully.`,
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("Update Service Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating service status.",
    });
  }
};

// ================= GET MECHANIC DASHBOARD STATS =================
const getMechanicDashboard = async (req, res) => {
  try {
    const isMechanic = req.user.role === "mechanic";
    const filter = isMechanic
      ? {
          $or: [
            { mechanic: req.user._id },
            { assignedMechanic: req.user._id },
          ],
        }
      : {};

    const [
      totalAssignedServices,
      pendingOffers,
      inServiceCount,
      inProgressCount,
      completedServices,
      readyForPickupServices,
    ] = await Promise.all([
      Booking.countDocuments({
        ...filter,
        assignmentStatus: "Accepted",
        status: { $ne: "Cancelled" },
      }),
      Booking.countDocuments({
        ...filter,
        assignmentStatus: "Pending Acceptance",
        status: { $ne: "Cancelled" },
      }),
      Booking.countDocuments({
        ...filter,
        assignmentStatus: "Accepted",
        status: "In Service",
      }),
      Booking.countDocuments({
        ...filter,
        assignmentStatus: "Accepted",
        status: "In Progress",
      }),
      Booking.countDocuments({
        ...filter,
        status: "Completed",
      }),
      Booking.countDocuments({
        ...filter,
        status: "Ready for Pickup",
      }),
    ]);

    const inProgressTotal = inServiceCount + inProgressCount;
    const completedTotal = completedServices + readyForPickupServices;

    res.status(200).json({
      success: true,
      totalAssignedServices,
      pendingOffers,
      pendingServices: pendingOffers,
      inProgressServices: inProgressTotal,
      completedServices: completedTotal,
      inServiceServices: inProgressTotal,
      readyForPickupServices,
    });
  } catch (error) {
    console.error("Get Mechanic Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard statistics.",
    });
  }
};

module.exports = {
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
};