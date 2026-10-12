const User = require("../models/User");
const Mechanic = require("../models/Mechanic");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");
const Category = require("../models/Category");
const Booking = require("../models/Booking");
const { assignNextEligibleMechanic } = require("../services/assignmentService");
const sendNotification = require("../utils/sendNotification");

// ==========================================================
// ADMIN DASHBOARD
// ==========================================================

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalMechanics,
      totalVehicles,
      totalServices,
      totalCategories,
      totalBookings,
      pendingBookings,
      completedBookings,
      awaitingAcceptance,
      escalatedBookings,
    ] = await Promise.all([
      // Total customers
      User.countDocuments({
        role: "customer",
      }),

      // Total mechanics
      Mechanic.countDocuments(),

      // Total vehicles
      Vehicle.countDocuments(),

      // Total services
      Service.countDocuments(),

      // Total categories
      Category.countDocuments(),

      // Total bookings
      Booking.countDocuments(),

      // Pending bookings
      Booking.countDocuments({
        status: "Pending",
      }),

      // Completed bookings
      Booking.countDocuments({
        status: "Completed",
      }),

      // Bookings awaiting mechanic acceptance
      Booking.countDocuments({
        assignmentStatus: "Pending Acceptance",
      }),

      // Escalated / unassigned bookings requiring admin attention
      Booking.countDocuments({
        assignmentStatus: { $in: ["Escalated", "Unassigned"] },
      }),
    ]);

    res.status(200).json({
      success: true,

      stats: {
        totalUsers,
        totalMechanics,
        totalVehicles,
        totalServices,
        totalCategories,
        totalBookings,
        pendingBookings,
        completedBookings,
        awaitingAcceptance,
        escalatedBookings,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while fetching dashboard statistics.",
    });
  }
};

// ==========================================================
// GET ALL BOOKINGS
// ==========================================================

const getAllBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "All") {
      filter.status = req.query.status;
    }
    if (req.query.assignmentStatus && req.query.assignmentStatus !== "All") {
      filter.assignmentStatus = req.query.assignmentStatus;
    }

    const bookings = await Booking.find(filter)
      .populate(
        "customer",
        "name email phone"
      )
      .populate(
        "vehicle",
        "brand model vehicleNumber year fuelType"
      )
      .populate(
        "service",
        "name description price duration"
      )
      .populate(
        "mechanic",
        "name email phone"
      )
      .populate(
        "assignedMechanic",
        "name email phone"
      )
      .populate(
        "rejectionHistory.mechanic",
        "name email phone"
      )
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get All Bookings Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while fetching bookings.",
    });
  }
};

// ==========================================================
// GET ALL VEHICLES
// ==========================================================

const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find()
      .populate(
        "user",
        "name email phone"
      )
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error("Get All Vehicles Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while fetching vehicles.",
    });
  }
};

// ==========================================================
// GET ALL USERS
// ==========================================================

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: "customer",
    })
      .select("-password")
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while fetching users.",
    });
  }
};

// ==========================================================
// GET ALL CATEGORIES
// ==========================================================

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);

    res.status(500).json({
      success: false,
      message:
        "Server error while fetching categories.",
    });
  }
};

// ==========================================================
// ADD CATEGORY
// ==========================================================

const addCategory = async (req, res) => {
  try {
    const {
      name,
      description,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "Category name is required.",
      });
    }

    const normalizedName =
      name.trim();

    const existingCategory =
      await Category.findOne({
        name: normalizedName,
      });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message:
          "Category already exists.",
      });
    }

    const category =
      await Category.create({
        name: normalizedName,

        description: description
          ? description.trim()
          : "",
      });

    res.status(201).json({
      success: true,
      message:
        "Category added successfully.",
      category,
    });
  } catch (error) {
    console.error(
      "Add Category Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while adding category.",
    });
  }
};

// ==========================================================
// UPDATE CATEGORY
// ==========================================================

const updateCategory = async (req, res) => {
  try {
    const category =
      await Category.findById(
        req.params.categoryId
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message:
          "Category not found.",
      });
    }

    const {
      name,
      description,
      isActive,
    } = req.body;

    // Update name
    if (name !== undefined) {
      const normalizedName =
        name.trim();

      const existingCategory =
        await Category.findOne({
          name: normalizedName,
          _id: {
            $ne: category._id,
          },
        });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Category name already exists.",
        });
      }

      category.name =
        normalizedName;
    }

    // Update description
    if (description !== undefined) {
      category.description =
        description.trim();
    }

    // Update active status
    if (isActive !== undefined) {
      category.isActive =
        isActive;
    }

    const updatedCategory =
      await category.save();

    res.status(200).json({
      success: true,
      message:
        "Category updated successfully.",
      category: updatedCategory,
    });
  } catch (error) {
    console.error(
      "Update Category Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while updating category.",
    });
  }
};

// ==========================================================
// DELETE CATEGORY
// ==========================================================

const deleteCategory = async (req, res) => {
  try {
    const category =
      await Category.findById(
        req.params.categoryId
      );

    if (!category) {
      return res.status(404).json({
        success: false,
        message:
          "Category not found.",
      });
    }

    // Check whether services are using this category
    const servicesUsingCategory =
      await Service.countDocuments({
        category: category._id,
      });

    if (servicesUsingCategory > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Category cannot be deleted because services are using it.",
      });
    }

    await Category.findByIdAndDelete(
      category._id
    );

    res.status(200).json({
      success: true,
      message:
        "Category deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete Category Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while deleting category.",
    });
  }
};

// ==========================================================
// GET REPORTS
// ==========================================================

const getReports = async (req, res) => {
  try {
    // Total bookings
    const totalBookings =
      await Booking.countDocuments();

    // Pending
    const pending =
      await Booking.countDocuments({
        status: "Pending",
      });

    // In Progress
    const inProgress =
      await Booking.countDocuments({
        status: "In Progress",
      });

    // Completed
    const completed =
      await Booking.countDocuments({
        status: "Completed",
      });

    // Cancelled
    const cancelled =
      await Booking.countDocuments({
        status: "Cancelled",
      });

    // Active users
    const activeUsers =
      await User.countDocuments({
        isActive: true,
      });

    // Inactive users
    const inactiveUsers =
      await User.countDocuments({
        isActive: false,
      });

    res.status(200).json({
      success: true,

      reports: {
        bookings: {
          total: totalBookings,
          pending,
          inProgress,
          completed,
          cancelled,
        },

        users: {
          active: activeUsers,
          inactive: inactiveUsers,
        },
      },
    });
  } catch (error) {
    console.error(
      "Reports Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while generating reports.",
    });
  }
};

// ==========================================================
// GET ACTIVITY
// ==========================================================

const getActivity = async (req, res) => {
  try {
    const recentBookings =
      await Booking.find()
        .populate(
          "customer",
          "name"
        )
        .populate(
          "service",
          "name"
        )
        .populate(
          "mechanic",
          "name"
        )
        .sort({
          updatedAt: -1,
        })
        .limit(20);

    res.status(200).json({
      success: true,
      count: recentBookings.length,
      activities:
        recentBookings,
    });
  } catch (error) {
    console.error(
      "Activity Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while fetching activity.",
    });
  }
};

// ==========================================================
// EMAIL STATUS & TESTING
// ==========================================================
const { verifyEmailConfig, sendEmail } = require("../utils/sendEmail");

const getEmailStatus = async (req, res) => {
  try {
    const status = await verifyEmailConfig();
    const user = (process.env.EMAIL_USER || "").trim();
    res.status(200).json({
      success: true,
      emailUser: user ? `${user.substring(0, 3)}***@${user.split("@")[1] || "gmail.com"}` : "Not Configured",
      isConfigured: status.configured,
      message: status.message,
      error: status.error || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const sendTestEmail = async (req, res) => {
  try {
    const targetEmail = req.body.email || req.user.email;
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: "Target email address is required.",
      });
    }

    const info = await sendEmail({
      to: targetEmail,
      subject: "Test Email - MRT Car Service Hub",
      recipientName: req.user?.name || "Administrator",
      heading: "SMTP Gmail Configuration Verified",
      intro: "This is a verification email confirming that your Gmail SMTP integration with MRT Car Service Hub is working successfully.",
      details: [
        { label: "Dispatch Timestamp", value: new Date().toLocaleString() },
        { label: "Recipient", value: targetEmail },
        { label: "Status", value: "Verified Active" },
      ],
      actionNote: "Transactional booking and mechanic status emails will now deliver properly.",
    });

    res.status(200).json({
      success: true,
      message: `Test email dispatched successfully to ${targetEmail}`,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      success: false,
      message: `Failed to send email: ${error.message}`,
    });
  }
};

// ==========================================================
// ADMIN REASSIGN BOOKING
// ==========================================================

const reassignBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { mechanicId, auto } = req.body || {};

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (auto) {
      const result = await assignNextEligibleMechanic(booking._id);
      return res.status(200).json({
        success: true,
        message: result.escalated
          ? "No eligible mechanics available; booking remains escalated."
          : `Booking automatically offered to ${result.mechanic?.name || "technician"}.`,
        escalated: result.escalated,
        booking: result.booking,
      });
    }

    if (!mechanicId) {
      return res.status(400).json({
        success: false,
        message: "Mechanic ID is required for manual assignment.",
      });
    }

    let mechanicUser = await User.findOne({
      _id: mechanicId,
      role: "mechanic",
      isActive: true,
    });

    if (!mechanicUser) {
      const mDoc = await Mechanic.findById(mechanicId).populate("user");
      if (mDoc && mDoc.user) {
        mechanicUser = mDoc.user;
      }
    }

    if (!mechanicUser) {
      return res.status(404).json({
        success: false,
        message: "Mechanic not found or inactive.",
      });
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

    await booking.save();

    await sendNotification(
      mechanicUser._id,
      "Job Assigned by Admin",
      `Administrator assigned you to service booking ${booking.bookingId}.`,
      "info"
    ).catch(() => {});

    const populated = await Booking.findById(booking._id)
      .populate("customer", "name email phone")
      .populate("vehicle", "brand model vehicleNumber year fuelType")
      .populate("service", "name description price duration")
      .populate("mechanic", "name email phone");

    res.status(200).json({
      success: true,
      message: `Booking manually assigned to ${mechanicUser.name}.`,
      booking: populated,
    });
  } catch (error) {
    console.error("Reassign Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reassigning booking.",
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
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
};