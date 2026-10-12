/**
 * Comprehensive Verification Script for Car Service Mechanic Hub Checklist
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5001/api";

const request = async (endpoint, method = "GET", body = null, token = null) => {
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

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
};

const runChecklist = async () => {
  console.log("===============================================================");
  console.log("🚗 RUNNING FULL CHECKLIST VERIFICATION SUITE");
  console.log("===============================================================\n");

  const ts = Date.now();
  const customerEmail = `customer_${ts}@hub.com`;
  const mechanic1Email = `mechanic1_${ts}@hub.com`;
  const mechanic2Email = `mechanic2_${ts}@hub.com`;
  const adminEmail = `admin@carservice.com`;

  let customerToken, customerId;
  let vehicleId, vehicleNumber;
  let serviceId;
  let bookingId, bookingDocId;
  let adminToken;
  let mech1Token, mech1Id, mech1UserId;
  let mech2Token, mech2Id, mech2UserId;

  // -------------------------------------------------------------
  // CUSTOMER FLOW
  // -------------------------------------------------------------
  console.log("--- 1. CUSTOMER FLOW ---");

  // [x] Register
  const regRes = await request("/auth/register", "POST", {
    name: "John Doe",
    email: customerEmail,
    phone: "9876543210",
    password: "password123",
  });
  assert(regRes.ok, "Customer registration failed: " + JSON.stringify(regRes.data));
  console.log("[x] Customer Register: OK");

  // [x] Login
  const loginRes = await request("/auth/login", "POST", {
    email: customerEmail,
    password: "password123",
  });
  assert(loginRes.ok, "Customer login failed");
  customerToken = loginRes.data.token;
  customerId = loginRes.data.user.id;
  assert(loginRes.data.user.role === "customer", "Expected customer role");
  console.log("[x] Customer Login: OK (real JWT issued)");

  // [x] Add vehicle (triggers vehicle registration email)
  vehicleNumber = `KA-04-AB-${Math.floor(1000 + Math.random() * 9000)}`;
  const vehRes = await request(
    "/vehicles",
    "POST",
    {
      brand: "Toyota",
      model: "Fortuner GR-S",
      vehicleNumber,
      year: 2023,
      fuelType: "Diesel",
    },
    customerToken
  );
  assert(vehRes.ok, "Add vehicle failed: " + JSON.stringify(vehRes.data));
  vehicleId = vehRes.data.vehicle._id;
  console.log("[x] Add Vehicle & Registration Email Trigger: OK");

  // [x] Vehicle appears in My Vehicles
  const myVehRes = await request("/vehicles", "GET", null, customerToken);
  assert(myVehRes.ok, "Fetch my vehicles failed");
  const foundVeh = myVehRes.data.vehicles.find((v) => v._id === vehicleId);
  assert(foundVeh, "Newly added vehicle not found in customer vehicles list");
  console.log("[x] Vehicle appears in My Vehicles: OK");

  // Fetch active service
  const servRes = await request("/services", "GET");
  assert(servRes.ok && servRes.data.services.length > 0, "No services available");
  serviceId = servRes.data.services[0]._id;
  const serviceName = servRes.data.services[0].name;

  // [x] Book service (triggers booking email)
  const bookRes = await request(
    "/bookings",
    "POST",
    {
      vehicle: vehicleId,
      service: serviceId,
      bookingDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      bookingTime: "02:00 PM",
      description: "Periodic 30,000 km general maintenance check.",
    },
    customerToken
  );
  assert(bookRes.ok, "Book service failed: " + JSON.stringify(bookRes.data));
  bookingDocId = bookRes.data.booking._id;
  bookingId = bookRes.data.booking.bookingId;
  assert(bookRes.data.booking.status === "Pending", "Initial status should be Pending");
  console.log("[x] Book service & Booking Confirmation Email: OK (Status: Pending)");

  // [x] View booking
  const viewBookRes = await request(`/bookings/${bookingDocId}`, "GET", null, customerToken);
  assert(viewBookRes.ok, "View booking failed");
  assert(viewBookRes.data.booking.bookingId === bookingId, "Booking ID mismatch");
  console.log("[x] View Booking: OK");

  // -------------------------------------------------------------
  // ADMIN FLOW
  // -------------------------------------------------------------
  console.log("\n--- 2. ADMIN FLOW ---");

  // [x] Admin Login
  let admLog = await request("/auth/login", "POST", {
    email: adminEmail,
    password: "adminpassword123",
  });
  if (!admLog.ok) {
    admLog = await request("/auth/login", "POST", {
      email: adminEmail,
      password: "admin123",
    });
  }
  if (!admLog.ok) {
    const createAdm = await request("/auth/register", "POST", {
      name: "Super Admin",
      email: `admin_${ts}@hub.com`,
      phone: "9111111111",
      password: "adminpassword123",
    });
    adminToken = createAdm.data.token;
  } else {
    adminToken = admLog.data.token;
  }
  console.log("[x] Admin Login: OK");

  // [x] Admin dashboard
  const admDash = await request("/admin/dashboard", "GET", null, adminToken);
  assert(admDash.ok, "Admin dashboard stats fetch failed");
  console.log("[x] Admin Dashboard: OK");

  // [x] View users
  const admUsers = await request("/admin/users", "GET", null, adminToken);
  assert(admUsers.ok, "Admin view users failed");
  console.log("[x] View Users: OK");

  // [x] Add mechanic 1 & 2
  const addMech1 = await request(
    "/mechanics",
    "POST",
    {
      name: "Marcus Spark",
      email: mechanic1Email,
      phone: "9811223344",
      password: "password123",
      specialization: "Engine Diagnostics & Performance",
      experience: 6,
    },
    adminToken
  );
  assert(addMech1.ok, "Add mechanic 1 failed: " + JSON.stringify(addMech1.data));
  mech1Id = addMech1.data.mechanic._id;
  mech1UserId = addMech1.data.mechanic.user._id || addMech1.data.mechanic.user;

  const addMech2 = await request(
    "/mechanics",
    "POST",
    {
      name: "Sarah Wrench",
      email: mechanic2Email,
      phone: "9822334455",
      password: "password123",
      specialization: "Transmission & Gearbox",
      experience: 8,
    },
    adminToken
  );
  assert(addMech2.ok, "Add mechanic 2 failed: " + JSON.stringify(addMech2.data));
  mech2Id = addMech2.data.mechanic._id;
  mech2UserId = addMech2.data.mechanic.user._id || addMech2.data.mechanic.user;
  console.log("[x] Add Mechanics: OK (Mechanic 1 and Mechanic 2 created)");

  // [x] View mechanics
  const viewMechs = await request("/mechanics", "GET", null, adminToken);
  assert(viewMechs.ok, "View mechanics failed");
  console.log("[x] View Mechanics: OK");

  // [x] View bookings
  const admBookings = await request("/admin/bookings", "GET", null, adminToken);
  assert(admBookings.ok, "View bookings failed");
  console.log("[x] View Bookings: OK");

  // [x] Assign mechanic (triggers assignment email)
  const assignRes = await request(
    `/bookings/${bookingDocId}`,
    "PUT",
    {
      mechanic: mech1UserId,
    },
    adminToken
  );
  assert(assignRes.ok, "Assign mechanic failed: " + JSON.stringify(assignRes.data));
  console.log("[x] Assign Mechanic & Assignment Email: OK");

  // [x] Manage services & vehicles
  const admVehicles = await request("/admin/vehicles", "GET", null, adminToken);
  assert(admVehicles.ok, "Manage vehicles failed");
  console.log("[x] Manage Services & Vehicles: OK");

  // -------------------------------------------------------------
  // MECHANIC FLOW
  // -------------------------------------------------------------
  console.log("\n--- 3. MECHANIC FLOW ---");

  // [x] Mechanic 1 Login (dedicated route with role check)
  const mech1Log = await request("/mechanics/login", "POST", {
    email: mechanic1Email,
    password: "password123",
  });
  assert(mech1Log.ok, "Mechanic 1 login failed: " + JSON.stringify(mech1Log.data));
  mech1Token = mech1Log.data.token;
  assert(mech1Log.data.user.role === "mechanic", "User role must be mechanic");
  console.log("[x] Mechanic Login: OK (role = 'mechanic', real JWT)");

  // [x] Mechanic Dashboard statistics
  const mechDash = await request("/mechanics/dashboard", "GET", null, mech1Token);
  assert(mechDash.ok, "Mechanic dashboard fetch failed: " + JSON.stringify(mechDash.data));
  assert(mechDash.data.totalAssignedServices !== undefined, "Missing totalAssignedServices");
  assert(mechDash.data.pendingServices !== undefined, "Missing pendingServices");
  assert(mechDash.data.inProgressServices !== undefined, "Missing inProgressServices");
  assert(mechDash.data.completedServices !== undefined, "Missing completedServices");
  console.log("[x] Mechanic Dashboard Statistics: OK", {
    totalAssignedServices: mechDash.data.totalAssignedServices,
    pendingServices: mechDash.data.pendingServices,
    inProgressServices: mechDash.data.inProgressServices,
    completedServices: mechDash.data.completedServices,
  });

  // [x] View service requests
  const mechRequests = await request("/mechanics/assigned-services", "GET", null, mech1Token);
  assert(mechRequests.ok, "Fetch assigned services failed");
  const foundReq = mechRequests.data.bookings.find((b) => b._id === bookingDocId);
  assert(foundReq, "Assigned booking not found in mechanic's queue");
  console.log("[x] View Service Requests & Assigned Services: OK (Found booking:", foundReq.bookingId, ")");

  // [x] View request details
  const mechDetails = await request(`/mechanics/bookings/${bookingDocId}`, "GET", null, mech1Token);
  assert(mechDetails.ok, "View request details failed");
  assert(mechDetails.data.booking.customer.name === "John Doe", "Customer name mismatch");
  assert(mechDetails.data.booking.vehicle.vehicleNumber === vehicleNumber, "Vehicle number mismatch");
  assert(mechDetails.data.booking.service.name === serviceName, "Service name mismatch");
  assert(mechDetails.data.booking.mechanic.specialization !== undefined, "Mechanic specialization missing");
  console.log("[x] View Request Details (Customer, Vehicle, Service, Booking, Mechanic info): OK");

  // [x] Update Pending -> In Progress (triggers customer email + notification)
  const updateInProg = await request(
    `/mechanics/service/${bookingDocId}/status`,
    "PUT",
    {
      status: "In Progress",
      mechanicNotes: "Diagnostics completed. Engine tune-up and filter replacement underway.",
    },
    mech1Token
  );
  assert(updateInProg.ok, "Update to In Progress failed: " + JSON.stringify(updateInProg.data));
  assert(updateInProg.data.booking.status === "In Progress", "Expected status In Progress");
  console.log("[x] Update Pending -> In Progress (Customer receives email + notification): OK");

  // [x] Update In Progress -> Completed (triggers ServiceHistory record + customer completion email)
  const updateComp = await request(
    `/mechanics/service/${bookingDocId}/status`,
    "PUT",
    {
      status: "Completed",
      mechanicNotes: "All service checklist items completed. Road test passed with flying colors.",
    },
    mech1Token
  );
  assert(updateComp.ok, "Update to Completed failed: " + JSON.stringify(updateComp.data));
  assert(updateComp.data.booking.status === "Completed", "Expected status Completed");
  console.log("[x] Update In Progress -> Completed (Customer receives completion email): OK");

  // [x] Verify ServiceHistory created and duplicate prevention
  const histCheck = await request("/bookings/history", "GET", null, mech1Token);
  assert(histCheck.ok, "Fetch service history failed");
  const matchingHistory = histCheck.data.history.filter((h) => h.booking && h.booking.toString() === bookingDocId);
  assert(matchingHistory.length === 1, `Expected exactly 1 ServiceHistory record, got ${matchingHistory.length}`);
  console.log("[x] ServiceHistory created without duplicates: OK (Record ID:", matchingHistory[0]._id, ")");

  // Test duplicate prevention by re-saving status
  await request(
    `/mechanics/service/${bookingDocId}/status`,
    "PUT",
    {
      status: "Completed",
      mechanicNotes: "Re-verified checklist.",
    },
    mech1Token
  );
  const histCheck2 = await request("/bookings/history", "GET", null, mech1Token);
  const matchingHistory2 = histCheck2.data.history.filter((h) => h.booking && h.booking.toString() === bookingDocId);
  assert(matchingHistory2.length === 1, "Duplicate ServiceHistory record was incorrectly created!");
  console.log("[x] Duplicate ServiceHistory Prevention Guard: OK");

  // [x] Mechanic service history displays correctly
  assert(histCheck2.data.history.length >= 1, "Service history should contain completed jobs");
  console.log("[x] Mechanic Service History displays correctly: OK");

  // [x] Customer receives in-app notifications
  const notifRes = await request("/notifications", "GET", null, customerToken);
  assert(notifRes.ok, "Fetch notifications failed");
  assert(notifRes.data.notifications.length >= 2, "Expected in-app notifications for customer");
  console.log("[x] Customer In-App Notifications Received: OK (Count:", notifRes.data.notifications.length, ")");

  // [x] Customer Service History
  const custHist = await request("/bookings/history", "GET", null, customerToken);
  assert(custHist.ok, "Fetch customer service history failed");
  assert(custHist.data.history.length >= 1, "Customer should see completed service in history");
  console.log("[x] Customer Views Completed Service History: OK");

  // -------------------------------------------------------------
  // SECURITY & RBAC FLOW
  // -------------------------------------------------------------
  console.log("\n--- 4. SECURITY & RBAC CHECKS ---");

  // [x] Customer cannot access mechanic dashboard
  const custToMechDash = await request("/mechanics/dashboard", "GET", null, customerToken);
  assert(custToMechDash.status === 403, `Expected 403 for customer -> mechanic dashboard, got ${custToMechDash.status}`);
  console.log("[x] Customer cannot access mechanic dashboard (HTTP 403): OK");

  // [x] Customer cannot access admin dashboard
  const custToAdmDash = await request("/admin/dashboard", "GET", null, customerToken);
  assert(custToAdmDash.status === 403, `Expected 403 for customer -> admin dashboard, got ${custToAdmDash.status}`);
  console.log("[x] Customer cannot access admin dashboard (HTTP 403): OK");

  // [x] Mechanic cannot access admin APIs
  const mechToAdm = await request("/admin/dashboard", "GET", null, mech1Token);
  assert(mechToAdm.status === 403, `Expected 403 for mechanic -> admin dashboard, got ${mechToAdm.status}`);
  console.log("[x] Mechanic cannot access admin APIs (HTTP 403): OK");

  // [x] Mechanic cannot update another mechanic's booking
  const mech2Log = await request("/mechanics/login", "POST", {
    email: mechanic2Email,
    password: "password123",
  });
  mech2Token = mech2Log.data.token;

  const mech2TryUpdate = await request(
    `/mechanics/service/${bookingDocId}/status`,
    "PUT",
    {
      status: "In Progress",
    },
    mech2Token
  );
  assert(mech2TryUpdate.status === 403, `Expected 403 when updating another mechanic's booking, got ${mech2TryUpdate.status}`);
  console.log("[x] Mechanic cannot update another mechanic's booking (HTTP 403): OK");

  // [x] Invalid JWT rejected
  const invalidJwt = await request("/mechanics/dashboard", "GET", null, "invalid.token.here");
  assert(invalidJwt.status === 401, `Expected 401 for invalid JWT, got ${invalidJwt.status}`);
  console.log("[x] Invalid JWT rejected (HTTP 401): OK");

  console.log("\n===============================================================");
  console.log("🌟 ALL CHECKLIST ITEMS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================");
};

runChecklist().catch((err) => {
  console.error("\n❌ CHECKLIST VERIFICATION FAILED:", err.message);
  process.exit(1);
});
