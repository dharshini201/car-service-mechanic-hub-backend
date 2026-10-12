const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    console.log("MongoDB connected.");

    const adminEmail = "admin@carservice.com";
    const adminPassword = "admin123";

    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log("Admin account already exists.");

      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
        await existingAdmin.save();

        console.log("Existing account role updated to admin.");
      }

      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      adminPassword,
      10
    );

    const admin = await User.create({
      name: "Admin",
      email: adminEmail,
      phone: "9999999999",
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    console.log("=================================");
    console.log("Admin account created successfully!");
    console.log("Email:", admin.email);
    console.log("Password:", adminPassword);
    console.log("Role:", admin.role);
    console.log("=================================");

    process.exit(0);

  } catch (error) {
    console.error("Admin creation error:", error);
    process.exit(1);
  }
};

createAdmin();