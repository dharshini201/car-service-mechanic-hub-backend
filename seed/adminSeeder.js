const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dns = require("dns");
require("dotenv").config();

// Configure DNS for mongodb+srv resolution on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  console.warn("DNS Notice:", e.message);
}

const User = require("../models/User");
const Mechanic = require("../models/Mechanic");
const Vehicle = require("../models/Vehicle");
const Category = require("../models/Category");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas for seeding...");

    // ================= 1. SEED ADMIN =================
    const adminEmail = "admin@carservice.com";
    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      const hashedAdminPassword = await bcrypt.hash("admin123", 10);
      admin = await User.create({
        name: "Car Service Admin",
        email: adminEmail,
        phone: "9876543210",
        password: hashedAdminPassword,
        role: "admin",
        isActive: true,
      });
      console.log("Created Admin: admin@carservice.com (password: admin123)");
    } else {
      console.log("Admin already exists: admin@carservice.com");
    }

    // ================= 2. SEED CATEGORIES =================
    const categoryData = [
      {
        name: "Periodic Maintenance",
        description: "Routine inspections, fluid changes, and regular checkups.",
      },
      {
        name: "Brake & Suspension",
        description: "Brake pads, rotors, hydraulics, shocks, and steering components.",
      },
      {
        name: "Engine & Transmission",
        description: "Diagnostics, tune-ups, belts, spark plugs, and drivetrain care.",
      },
      {
        name: "AC & Electrical",
        description: "Climate control, refrigerant recharge, battery, and wiring diagnostics.",
      },
      {
        name: "Tire & Wheel Care",
        description: "Wheel balancing, rotation, tire mounting, and alignment.",
      },
      {
        name: "Detailing & Wash",
        description: "Premium interior vacuuming, exterior shampoo, and paint protection.",
      },
    ];

    const categoryMap = {};
    for (const cat of categoryData) {
      let existingCat = await Category.findOne({ name: cat.name });
      if (!existingCat) {
        existingCat = await Category.create(cat);
        console.log(`Created Category: ${cat.name}`);
      }
      categoryMap[cat.name] = existingCat._id;
    }

    // ================= 3. SEED SERVICES =================
    const serviceData = [
      {
        name: "Engine Diagnostic & Tune-Up",
        description: "Comprehensive multi-point engine scan, spark plug check, throttle body clean, and performance optimization.",
        price: 120,
        duration: "2 - 3 Hours",
        category: categoryMap["Engine & Transmission"] || null,
        icon: "bi-gear-wide-connected",
        isActive: true,
      },
      {
        name: "Brake Pad & Rotor Replacement",
        description: "Complete brake pad replacement, rotor resurfacing/inspection, brake fluid flush, and braking road-test.",
        price: 95,
        duration: "1 - 2 Hours",
        category: categoryMap["Brake & Suspension"] || null,
        icon: "bi-disc",
        isActive: true,
      },
      {
        name: "Full Synthetic Oil & Filter Change",
        description: "Premium grade full-synthetic engine oil replacement, OEM oil filter change, and free 15-point safety inspection.",
        price: 65,
        duration: "45 Minutes",
        category: categoryMap["Periodic Maintenance"] || null,
        icon: "bi-droplet-half",
        isActive: true,
      },
      {
        name: "Complete AC Inspection & Gas Refill",
        description: "AC condenser flush, cabin air filter replacement, cooling leak diagnostic test, and high-purity R134a refrigerant refill.",
        price: 85,
        duration: "1 - 2 Hours",
        category: categoryMap["AC & Electrical"] || null,
        icon: "bi-snow",
        isActive: true,
      },
      {
        name: "High-Performance Battery Test & Replacement",
        description: "Computerized battery load test, terminal anti-corrosion cleaning, alternator output verification, and quick installation.",
        price: 110,
        duration: "1 Hour",
        category: categoryMap["AC & Electrical"] || null,
        icon: "bi-battery-charging",
        isActive: true,
      },
      {
        name: "Comprehensive 50-Point General Service",
        description: "Full vehicle bumper-to-bumper inspection including lights, fluids, suspension, belts, tire pressure, and onboard diagnostics.",
        price: 180,
        duration: "3 - 4 Hours",
        category: categoryMap["Periodic Maintenance"] || null,
        icon: "bi-tools",
        isActive: true,
      },
    ];

    for (const s of serviceData) {
      const existingService = await Service.findOne({ name: s.name });
      if (!existingService) {
        await Service.create(s);
        console.log(`Created Service: ${s.name}`);
      }
    }

    // ================= 4. SEED MECHANICS =================
    const mechanicUsers = [
      {
        name: "John Carter",
        email: "mechanic@carservice.com",
        phone: "9876543211",
        password: "mechanic123",
        role: "mechanic",
        experience: 8,
      },
      {
        name: "Alex Rivera",
        email: "mechanic2@carservice.com",
        phone: "9876543212",
        password: "mechanic123",
        role: "mechanic",
        experience: 6,
      },
    ];

    for (const m of mechanicUsers) {
      let mUser = await User.findOne({ email: m.email });
      if (!mUser) {
        const hashedPassword = await bcrypt.hash(m.password, 10);
        mUser = await User.create({
          name: m.name,
          email: m.email,
          phone: m.phone,
          password: hashedPassword,
          role: m.role,
          isActive: true,
        });
        console.log(`Created Mechanic User: ${m.email} (password: ${m.password})`);
      }

      let mProfile = await Mechanic.findOne({ user: mUser._id });
      if (!mProfile) {
        await Mechanic.create({
          user: mUser._id,
          experience: m.experience,
          phone: m.phone,
          isAvailable: true,
          status: "Active",
        });
        console.log(`Created Mechanic Profile for: ${m.name}`);
      }
    }

    // ================= 5. SEED DEMO CUSTOMER & VEHICLES =================
    const customerEmail = "customer@carservice.com";
    let customer = await User.findOne({ email: customerEmail });
    if (!customer) {
      const hashedCustPassword = await bcrypt.hash("customer123", 10);
      customer = await User.create({
        name: "Alex Morgan",
        email: customerEmail,
        phone: "9876543220",
        password: hashedCustPassword,
        role: "customer",
        isActive: true,
      });
      console.log("Created Customer: customer@carservice.com (password: customer123)");
    }

    const demoVehicles = [
      {
        user: customer._id,
        brand: "Toyota",
        model: "Land Cruiser",
        vehicleNumber: "TN01AB1234",
        year: 2023,
        fuelType: "Diesel",
      },
      {
        user: customer._id,
        brand: "Mitsubishi",
        model: "Pajero",
        vehicleNumber: "TN01CD5678",
        year: 2022,
        fuelType: "Diesel",
      },
      {
        user: customer._id,
        brand: "BMW",
        model: "i4",
        vehicleNumber: "TN01EV9999",
        year: 2024,
        fuelType: "Electric",
      },
    ];

    for (const v of demoVehicles) {
      const existingVehicle = await Vehicle.findOne({ vehicleNumber: v.vehicleNumber });
      if (!existingVehicle) {
        await Vehicle.create(v);
        console.log(`Created Vehicle: ${v.brand} ${v.model} (${v.vehicleNumber})`);
      }
    }

    console.log("=========================================");
    console.log("MRT Car Service Seeding Completed Successfully!");
    console.log("=========================================");
    process.exit(0);
  } catch (error) {
    console.error("Seeder Error:", error);
    process.exit(1);
  }
};

seedData();