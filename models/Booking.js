const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    vehicleModel: {
      type: String,
      trim: true,
      default: "",
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    serviceType: {
      type: String,
      trim: true,
      default: "",
    },

    mechanic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedMechanic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    bookingDate: {
      type: Date,
      required: true,
    },

    bookingTime: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Main status (synchronized with serviceStatus & bookingStatus)
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "In Service",
        "In Progress",
        "Completed",
        "Ready for Pickup",
        "Cancelled",
      ],
      default: "Pending",
    },

    bookingStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "In Service",
        "In Progress",
        "Completed",
        "Ready for Pickup",
        "Cancelled",
      ],
      default: "Pending",
    },

    serviceStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "In Service",
        "In Progress",
        "Completed",
        "Ready for Pickup",
        "Cancelled",
      ],
      default: "Pending",
    },

    mechanicNotes: {
      type: String,
      trim: true,
      default: "",
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // Keeps track of which status emails have been dispatched to avoid duplicates
    emailedStatuses: {
      type: [String],
      default: [],
    },

    // Assignment lifecycle status
    assignmentStatus: {
      type: String,
      enum: [
        "Unassigned",
        "Pending Acceptance",
        "Accepted",
        "Rejected",
        "Reassigned",
        "Escalated",
      ],
      default: "Unassigned",
    },

    lastOfferedAt: {
      type: Date,
      default: null,
    },

    // Record of mechanic rejections for this booking
    rejectionHistory: [
      {
        mechanic: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reason: {
          type: String,
          default: "Declined by technician",
          trim: true,
        },
        rejectedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Complete audit trail of assignment transitions
    assignmentHistory: [
      {
        mechanic: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        action: {
          type: String,
          enum: [
            "OFFERED",
            "ACCEPTED",
            "REJECTED",
            "REASSIGNED",
            "ESCALATED",
            "MANUAL_ASSIGNED",
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: String,
          default: "SYSTEM",
        },
        notes: {
          type: String,
          default: "",
        },
      },
    ],
    // Audit trail of service status progress transitions
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure bookingId, assignedMechanic, and status sync
bookingSchema.pre("save", function () {
  if (!this.bookingId) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.bookingId = `BK-${randomSuffix}`;
  }

  // Keep mechanic and assignedMechanic synced
  if (this.mechanic && !this.assignedMechanic) {
    this.assignedMechanic = this.mechanic;
  } else if (this.assignedMechanic && !this.mechanic) {
    this.mechanic = this.assignedMechanic;
  }

  // Keep status, serviceStatus, bookingStatus aligned
  if (this.isModified("status")) {
    this.serviceStatus = this.status;
    this.bookingStatus = this.status;
  } else if (this.isModified("serviceStatus")) {
    this.status = this.serviceStatus;
    this.bookingStatus = this.serviceStatus;
  }

  // Set completedAt when status reaches Completed or Ready for Pickup
  if (
    ["Completed", "Ready for Pickup"].includes(this.status) &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;