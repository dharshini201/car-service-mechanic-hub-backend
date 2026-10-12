require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Mechanic = require("./models/Mechanic");
const Booking = require("./models/Booking");
const Vehicle = require("./models/Vehicle");
const Service = require("./models/Service");

const BASE_URL = process.env.BASE_URL || "http://localhost:5001/api";

const api = async (endpoint, method = "GET", body = null, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
};

const runCrudTests = async () => {
  console.log("================================================================================");
  console.log("STARTING ADMIN BOOKING CRUD & REASSIGN VERIFICATION SUITE");
  console.log("================================================================================");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const ts = Date.now();
  let adminToken = null;
  let customerUser = null;
  let testVehicle = null;
  let testService = null;
  let createdBookingId = null;

  try {
    // 1. Login as Admin
    console.log("\n[STEP 1] Login as Administrator");
    const adminLogin = await api("/auth/login", "POST", {
      email: "admin@carservice.com",
      password: "admin123",
    });
    if (!adminLogin.ok) throw new Error("Admin login failed");
    adminToken = adminLogin.data.token;
    console.log("Admin authenticated successfully.");

    // 2. Setup Customer, Vehicle & Service
    console.log("\n[STEP 2] Provision test Customer, Vehicle & Service");
    const custEmail = `crud_cust_${ts}@example.com`;
    const custRes = await api("/auth/register", "POST", {
      name: "CRUD Test Customer",
      email: custEmail,
      phone: "9876543299",
      password: "password123",
      role: "customer",
    });
    customerUser = custRes.data.user;

    testVehicle = await Vehicle.create({
      user: customerUser.id,
      brand: "Honda",
      model: "City",
      year: 2021,
      vehicleNumber: `TN-${Math.floor(1000 + Math.random() * 9000)}`,
      fuelType: "Petrol",
    });

    testService = await Service.findOne() || await Service.create({
      name: "General Inspection",
      description: "Complete vehicle checkup",
      price: 1200,
      duration: "1.5 hours",
      category: "Inspection",
    });
    console.log(`Setup complete. Customer: ${customerUser.id}, Vehicle: ${testVehicle._id}, Service: ${testService._id}`);

    // 3. Admin CREATE Booking (POST /api/bookings)
    console.log("\n[TEST 1: CREATE] Admin creates a new service booking for customer");
    const createRes = await api(
      "/bookings",
      "POST",
      {
        customer: customerUser.id,
        vehicle: testVehicle._id,
        service: testService._id,
        bookingDate: "2026-10-15",
        bookingTime: "10:00 AM",
        serviceType: "Workshop",
        description: "Created directly via Admin Management Console",
      },
      adminToken
    );

    console.log("Create status:", createRes.status);
    console.log("Created booking ID:", createRes.data?.booking?.bookingId);
    if (createRes.status !== 201 || !createRes.data?.booking?._id) {
      throw new Error(`TEST 1 FAILED: Could not create booking: ${JSON.stringify(createRes.data)}`);
    }
    createdBookingId = createRes.data.booking._id;
    console.log("PASSED: Admin successfully created booking!");

    // 4. Admin READ Single Booking (GET /api/bookings/:id)
    console.log("\n[TEST 2: READ] Admin reads single booking details");
    const readRes = await api(`/bookings/${createdBookingId}`, "GET", null, adminToken);
    console.log("Read status:", readRes.status);
    console.log("Customer name in details:", readRes.data?.booking?.customer?.name);
    console.log("Vehicle in details:", readRes.data?.booking?.vehicle?.brand);
    if (readRes.status !== 200 || !readRes.data?.booking) {
      throw new Error(`TEST 2 FAILED: Could not read booking: ${JSON.stringify(readRes.data)}`);
    }
    console.log("PASSED: Admin read booking details with all populated fields!");

    // 5. Admin Auto-Dispatch (POST /api/admin/bookings/:id/reassign with { auto: true })
    console.log("\n[TEST 3: AUTO-DISPATCH] Admin triggers Auto-Dispatch on booking");
    const autoDispatchRes = await api(
      `/admin/bookings/${createdBookingId}/reassign`,
      "POST",
      { auto: true },
      adminToken
    );
    console.log("Auto-Dispatch status:", autoDispatchRes.status);
    console.log("Auto-Dispatch message:", autoDispatchRes.data?.message);
    if (autoDispatchRes.status !== 200) {
      throw new Error(`TEST 3 FAILED: Auto dispatch failed: ${JSON.stringify(autoDispatchRes.data)}`);
    }
    console.log("PASSED: Auto-dispatch completed without 'null' JSON syntax error!");

    // 6. Admin UPDATE Booking (PUT /api/bookings/:id)
    console.log("\n[TEST 4: UPDATE] Admin updates service, schedule and notes");
    const updateRes = await api(
      `/bookings/${createdBookingId}`,
      "PUT",
      {
        bookingDate: "2026-10-18",
        bookingTime: "02:00 PM",
        status: "In Progress",
        description: "Admin updated instructions and shifted appointment date",
      },
      adminToken
    );
    console.log("Update status:", updateRes.status);
    console.log("Updated status value:", updateRes.data?.booking?.status);
    if (updateRes.status !== 200 || updateRes.data?.booking?.status !== "In Progress") {
      throw new Error(`TEST 4 FAILED: Update booking failed: ${JSON.stringify(updateRes.data)}`);
    }
    console.log("PASSED: Admin updated booking schedule and status successfully!");

    // 7. Admin CANCEL Booking (PUT /api/bookings/:id/cancel)
    console.log("\n[TEST 5: CANCEL] Admin cancels the booking");
    const cancelRes = await api(`/bookings/${createdBookingId}/cancel`, "PUT", null, adminToken);
    console.log("Cancel status:", cancelRes.status);
    console.log("Cancelled status value:", cancelRes.data?.booking?.status);
    if (cancelRes.status !== 200 || cancelRes.data?.booking?.status !== "Cancelled") {
      throw new Error(`TEST 5 FAILED: Cancel booking failed: ${JSON.stringify(cancelRes.data)}`);
    }
    console.log("PASSED: Admin cancelled booking successfully!");

    // 8. Admin DELETE Booking (DELETE /api/bookings/:id)
    console.log("\n[TEST 6: DELETE] Admin permanently deletes the booking");
    const deleteRes = await api(`/bookings/${createdBookingId}`, "DELETE", null, adminToken);
    console.log("Delete status:", deleteRes.status);
    console.log("Delete message:", deleteRes.data?.message);
    if (deleteRes.status !== 200) {
      throw new Error(`TEST 6 FAILED: Delete booking failed: ${JSON.stringify(deleteRes.data)}`);
    }

    // Verify it no longer exists
    const verifyDel = await api(`/bookings/${createdBookingId}`, "GET", null, adminToken);
    if (verifyDel.status !== 404) {
      throw new Error("TEST 6 FAILED: Booking still exists after delete!");
    }
    console.log("PASSED: Booking permanently deleted from database!");
    createdBookingId = null;

    console.log("\n================================================================================");
    console.log("ALL 6 ADMIN BOOKING CRUD TESTS PASSED CLEANLY (6/6)!");
    console.log("================================================================================");
  } catch (err) {
    console.error("\nTEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    console.log("\nCleaning up test artifacts...");
    try {
      if (createdBookingId) {
        await Booking.findByIdAndDelete(createdBookingId);
      }
      if (customerUser) {
        await Booking.deleteMany({ customer: customerUser.id });
        await Vehicle.deleteMany({ user: customerUser.id });
        await User.findByIdAndDelete(customerUser.id);
      }
    } catch (_) {}
    await mongoose.disconnect();
    console.log("Teardown complete.");
  }
};

runCrudTests();
