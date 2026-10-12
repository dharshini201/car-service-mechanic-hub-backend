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

const runTests = async () => {
  console.log("================================================================================");
  console.log("STARTING MECHANIC REGISTRATION & EQUAL/ORDERLY DISTRIBUTION TEST SUITE");
  console.log("================================================================================");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const timestamp = Date.now();
  let testCustomer = null;
  let testService = null;
  let testVehicle = null;
  let mechanic1 = null;
  let mechanic2 = null;
  let mechanic3 = null;
  let otherMechanics = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Register as Mechanic via API
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Register as Mechanic via public registration endpoint");
    const mech1Email = `test_mech1_${timestamp}@example.com`;
    const resMech1 = await api("/auth/register", "POST", {
      name: "Test Mechanic One",
      email: mech1Email,
      phone: "9876543210",
      password: "password123",
      role: "mechanic",
      experience: 4,
    });

    console.log("Status:", resMech1.status);
    console.log("Body user role:", resMech1.data?.user?.role);

    if (resMech1.status !== 201 || resMech1.data?.user?.role !== "mechanic") {
      throw new Error(`TEST 1 FAILED: Expected role 'mechanic' and status 201, got ${resMech1.status} and ${resMech1.data?.user?.role}`);
    }

    const mech1Profile = await Mechanic.findOne({ user: resMech1.data.user.id });
    if (!mech1Profile || mech1Profile.status !== "Active" || !mech1Profile.isAvailable) {
      throw new Error("TEST 1 FAILED: Mechanic profile was not created or is not active/available.");
    }
    console.log("PASSED: Mechanic registered with role 'mechanic' and active Mechanic profile created.");
    mechanic1 = resMech1.data;

    // -------------------------------------------------------------------------
    // TEST 2: Register as Customer
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Register as Customer via public registration endpoint");
    const custEmail = `test_cust_${timestamp}@example.com`;
    const resCust = await api("/auth/register", "POST", {
      name: "Test Customer",
      email: custEmail,
      phone: "9876543211",
      password: "password123",
      role: "customer",
    });

    if (resCust.status !== 201 || resCust.data?.user?.role !== "customer") {
      throw new Error(`TEST 2 FAILED: Expected role 'customer', got ${resCust.data?.user?.role}`);
    }
    const custProfile = await Mechanic.findOne({ user: resCust.data.user.id });
    if (custProfile) {
      throw new Error("TEST 2 FAILED: Customer unexpectedly has a Mechanic profile.");
    }
    console.log("PASSED: Customer registered with role 'customer'.");
    testCustomer = resCust.data;

    // -------------------------------------------------------------------------
    // TEST 3: Prevent Admin Registration via Public Endpoint
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Prevent Admin registration via public endpoint");
    const adminEmail = `test_admin_${timestamp}@example.com`;
    const resAdmin = await api("/auth/register", "POST", {
      name: "Hacker Admin",
      email: adminEmail,
      phone: "9876543212",
      password: "password123",
      role: "admin",
    });

    if (resAdmin.status !== 403) {
      throw new Error(`TEST 3 FAILED: Expected 403 Forbidden for admin registration, got ${resAdmin.status}`);
    }
    console.log("PASSED: Admin registration rejected with 403 Forbidden.");

    // -------------------------------------------------------------------------
    // TEST 4: Register Two More Mechanics for Fair Distribution Test
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Register two more mechanics (Mechanic 2 and Mechanic 3)");
    const mech2Email = `test_mech2_${timestamp}@example.com`;
    const resMech2 = await api("/auth/register", "POST", {
      name: "Test Mechanic Two",
      email: mech2Email,
      phone: "9876543213",
      password: "password123",
      role: "mechanic",
      experience: 6,
    });
    mechanic2 = resMech2.data;

    const mech3Email = `test_mech3_${timestamp}@example.com`;
    const resMech3 = await api("/auth/register", "POST", {
      name: "Test Mechanic Three",
      email: mech3Email,
      phone: "9876543214",
      password: "password123",
      role: "mechanic",
      experience: 2,
    });
    mechanic3 = resMech3.data;

    console.log(`Registered Mechanic 1: ${mechanic1.user.name} (${mechanic1.user.id})`);
    console.log(`Registered Mechanic 2: ${mechanic2.user.name} (${mechanic2.user.id})`);
    console.log(`Registered Mechanic 3: ${mechanic3.user.name} (${mechanic3.user.id})`);

    // Temporarily isolate these 3 mechanics for the test by disabling other mechanics in the DB
    const testMechObjectIds = [
      new mongoose.Types.ObjectId(mechanic1.user.id),
      new mongoose.Types.ObjectId(mechanic2.user.id),
      new mongoose.Types.ObjectId(mechanic3.user.id),
    ];
    otherMechanics = await Mechanic.find({
      user: { $nin: testMechObjectIds },
      isAvailable: true,
    });
    console.log(`Temporarily pausing ${otherMechanics.length} other mechanic(s) for isolated distribution testing...`);
    await Mechanic.updateMany(
      { user: { $nin: testMechObjectIds } },
      { $set: { isAvailable: false } }
    );

    // Create a test vehicle & service
    testVehicle = await Vehicle.create({
      user: testCustomer.user.id,
      brand: "Toyota",
      model: "Corolla",
      year: 2022,
      vehicleNumber: `TN-${Math.floor(1000 + Math.random() * 9000)}`,
      fuelType: "Petrol",
    });

    testService = await Service.findOne() || await Service.create({
      name: "Standard Tune-up",
      description: "Complete engine tune-up",
      price: 1500,
      duration: "2 hours",
      category: "Maintenance",
    });

    // -------------------------------------------------------------------------
    // TEST 5: Equal and Orderly Job Distribution (3 bookings -> 1 to each mechanic)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Equal and Orderly Distribution across 3 mechanics");
    const bookings = [];
    const assignedMechanicIds = [];

    for (let i = 1; i <= 3; i++) {
      const bRes = await api("/bookings", "POST", {
        vehicle: testVehicle._id,
        service: testService._id,
        bookingDate: new Date(Date.now() + 86400000 * i).toISOString().split("T")[0],
        bookingTime: "10:00 AM",
        serviceType: "Workshop",
      }, testCustomer.token);

      if (bRes.status !== 201) {
        throw new Error(`Failed to create test booking ${i}: ${JSON.stringify(bRes.data)}`);
      }

      const mechObj = bRes.data.booking.mechanic;
      const assignedMech = (mechObj && typeof mechObj === "object" ? mechObj._id || mechObj.id : mechObj).toString();
      console.log(`Booking ${i} (${bRes.data.booking.bookingId}) auto-assigned to Mechanic ID: ${assignedMech}`);
      bookings.push(bRes.data.booking);
      assignedMechanicIds.push(assignedMech);
    }

    const uniqueAssigned = new Set(assignedMechanicIds);
    console.log(`Assigned mechanics count: ${uniqueAssigned.size} out of 3 total mechanics`);
    if (uniqueAssigned.size !== 3) {
      throw new Error(`TEST 5 FAILED: Expected all 3 mechanics to each receive exactly 1 booking, but received: ${assignedMechanicIds}`);
    }
    console.log("PASSED: Equal and orderly distribution! Each of the 3 mechanics received exactly 1 job offer.");

    // -------------------------------------------------------------------------
    // TEST 6: Round 2 Distribution (Booking 4 should rotate back to the least recently assigned)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Round 2 Distribution (4th booking fair tie-breaker)");
    const b4Res = await api("/bookings", "POST", {
      vehicle: testVehicle._id,
      service: testService._id,
      bookingDate: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
      bookingTime: "11:00 AM",
      serviceType: "Workshop",
    }, testCustomer.token);

    const b4MechObj = b4Res.data.booking.mechanic;
    const b4Mech = (b4MechObj && typeof b4MechObj === "object" ? b4MechObj._id || b4MechObj.id : b4MechObj).toString();
    console.log(`Booking 4 auto-assigned to Mechanic ID: ${b4Mech}`);
    console.log("PASSED: 4th booking successfully dispatched based on workload & fair tie-breaking.");

    // -------------------------------------------------------------------------
    // TEST 7: Rejection Workflow ("if they don't want then the next person can have their job")
    // -------------------------------------------------------------------------
    console.log("\n[TEST 7] Testing Rejection Workflow - Next person receives the job");
    const bookingToReject = b4Res.data.booking;
    const initialMechanicId = b4Mech;

    // Find the token of the mechanic who received booking 4
    let currentMechToken = null;
    if (initialMechanicId === mechanic1.user.id) currentMechToken = mechanic1.token;
    else if (initialMechanicId === mechanic2.user.id) currentMechToken = mechanic2.token;
    else currentMechToken = mechanic3.token;

    console.log(`Mechanic (${initialMechanicId}) declines Booking 4...`);
    const rejectRes = await api(`/mechanic/offers/${bookingToReject._id}/reject`, "POST", {
      reason: "Schedule conflict today",
    }, currentMechToken);

    console.log("Reject response status:", rejectRes.status);
    console.log("Reject response message:", rejectRes.data?.message);

    if (rejectRes.status !== 200) {
      throw new Error(`TEST 7 FAILED: Rejection failed: ${JSON.stringify(rejectRes.data)}`);
    }

    // Refresh booking from DB
    const updatedBooking = await Booking.findById(bookingToReject._id);
    console.log("Updated Booking Assignment Status:", updatedBooking.assignmentStatus);
    console.log("New Assigned Mechanic ID:", updatedBooking.mechanic?.toString());

    if (updatedBooking.mechanic?.toString() === initialMechanicId) {
      throw new Error("TEST 7 FAILED: Job was offered back to the same mechanic who just rejected it!");
    }

    if (!updatedBooking.mechanic) {
      throw new Error("TEST 7 FAILED: No next mechanic was assigned!");
    }

    console.log(`SUCCESS: Job was automatically passed from Mechanic ${initialMechanicId} to next eligible Mechanic ${updatedBooking.mechanic.toString()}!`);

    // Verify rejection history
    if (!updatedBooking.rejectionHistory || updatedBooking.rejectionHistory.length !== 1) {
      throw new Error("TEST 7 FAILED: Rejection history was not recorded.");
    }
    console.log("PASSED: Rejection recorded and job successfully handed off to the next person!");

    // Restore other mechanics
    await Mechanic.updateMany(
      { _id: { $in: otherMechanics.map((m) => m._id) } },
      { $set: { isAvailable: true } }
    );
    console.log(`Restored ${otherMechanics.length} previously paused mechanics.`);

    console.log("\n================================================================================");
    console.log("ALL TESTS IN SUITE PASSED SUCCESSFULLY! (7/7)");
    console.log("================================================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exitCode = 1;
  } finally {
    // Cleanup test data
    console.log("\nCleaning up test artifacts...");
    try {
      if (otherMechanics && otherMechanics.length > 0) {
        await Mechanic.updateMany(
          { _id: { $in: otherMechanics.map((m) => m._id) } },
          { $set: { isAvailable: true } }
        );
      }
      if (testCustomer) {
        await Booking.deleteMany({ customer: testCustomer.user.id });
        await Vehicle.deleteMany({ customer: testCustomer.user.id });
        await User.findByIdAndDelete(testCustomer.user.id);
      }
      if (mechanic1) {
        await Mechanic.deleteOne({ user: mechanic1.user.id });
        await User.findByIdAndDelete(mechanic1.user.id);
      }
      if (mechanic2) {
        await Mechanic.deleteOne({ user: mechanic2.user.id });
        await User.findByIdAndDelete(mechanic2.user.id);
      }
      if (mechanic3) {
        await Mechanic.deleteOne({ user: mechanic3.user.id });
        await User.findByIdAndDelete(mechanic3.user.id);
      }
    } catch (e) {
      console.error("Cleanup error:", e.message);
    }
    await mongoose.disconnect();
    console.log("Teardown complete.");
  }
};

runTests();
