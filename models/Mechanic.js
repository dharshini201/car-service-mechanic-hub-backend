const mongoose = require("mongoose");

const mechanicSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    specialization: {
      type: String,
      trim: true,
      default: "",
    },

    experience: {
      type: Number,
      min: 0,
      default: 0,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    lastAssignedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Mechanic = mongoose.model("Mechanic", mechanicSchema);

module.exports = Mechanic;