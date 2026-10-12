const User = require("../models/User");
const Mechanic = require("../models/Mechanic");
const Booking = require("../models/Booking");
const sendNotification = require("../utils/sendNotification");

/**
 * Calculates active workload for a given mechanic user ID.
 * Authoritative: Excludes Completed, Ready for Pickup, and Cancelled jobs.
 * Only counts bookings where assignmentStatus is "Pending Acceptance" or "Accepted".
 */
const getActiveWorkloadForMechanic = async (mechanicUserId) => {
  return await Booking.countDocuments({
    $or: [{ mechanic: mechanicUserId }, { assignedMechanic: mechanicUserId }],
    status: { $nin: ["Completed", "Ready for Pickup", "Cancelled"] },
    assignmentStatus: { $in: ["Pending Acceptance", "Accepted"] },
  });
};

/**
 * Retrieves all eligible mechanics sorted by lowest workload, then by least recently assigned.
 * Excludes any mechanics whose user IDs are in the excludeIds array (e.g. who already rejected this offer).
 */
const getEligibleMechanics = async (excludeUserIds = []) => {
  const normalizedExclude = excludeUserIds.map((id) => id.toString());

  // 1. Find active mechanic user accounts
  const mechanicUsers = await User.find({
    role: "mechanic",
    isActive: true,
  }).select("_id name email phone");

  if (!mechanicUsers || mechanicUsers.length === 0) {
    return [];
  }

  const userIds = mechanicUsers.map((u) => u._id);

  // 2. Find their mechanic profiles that are active and available
  const mechanicProfiles = await Mechanic.find({
    user: { $in: userIds },
    status: "Active",
    isAvailable: true,
  });

  const profileMap = new Map();
  mechanicProfiles.forEach((p) => {
    profileMap.set(p.user.toString(), p);
  });

  // Ensure any active mechanic users missing a profile document are provisioned
  for (const u of mechanicUsers) {
    const userIdStr = u._id.toString();
    if (!profileMap.has(userIdStr)) {
      try {
        const newProfile = await Mechanic.create({
          user: u._id,
          phone: u.phone || "",
          experience: 0,
          isAvailable: true,
          status: "Active",
        });
        profileMap.set(userIdStr, newProfile);
      } catch (err) {
        const existing = await Mechanic.findOne({ user: u._id });
        if (existing) profileMap.set(userIdStr, existing);
      }
    }
  }

  // Filter to users who have an active, available profile and are not excluded
  const eligibleUsers = mechanicUsers.filter((u) => {
    const userIdStr = u._id.toString();
    const profile = profileMap.get(userIdStr);
    const isAvail = profile && profile.status === "Active" && profile.isAvailable !== false;
    return isAvail && !normalizedExclude.includes(userIdStr);
  });

  if (eligibleUsers.length === 0) {
    return [];
  }

  // 3. Authoritative workload calculation for each eligible candidate
  const candidates = await Promise.all(
    eligibleUsers.map(async (u) => {
      const workload = await getActiveWorkloadForMechanic(u._id);
      const profile = profileMap.get(u._id.toString());
      return {
        user: u,
        profile,
        workload,
        lastAssignedAt: profile?.lastAssignedAt ? new Date(profile.lastAssignedAt).getTime() : 0,
      };
    })
  );

  // 4. Sort:
  // Primary: Lowest active workload
  // Secondary: Least recently assigned (smallest timestamp first; 0 = never assigned)
  // Tertiary: Deterministic order by user ID
  candidates.sort((a, b) => {
    if (a.workload !== b.workload) {
      return a.workload - b.workload;
    }
    if (a.lastAssignedAt !== b.lastAssignedAt) {
      return a.lastAssignedAt - b.lastAssignedAt;
    }
    return a.user._id.toString().localeCompare(b.user._id.toString());
  });

  return candidates;
};

/**
 * Automatically assigns an eligible mechanic with the lowest workload to a booking.
 * Handles reassignment cycles: excludes mechanics who already rejected this booking.
 * If no eligible mechanics are available, sets status to "Escalated" and notifies Admins.
 */
const assignNextEligibleMechanic = async (bookingId, additionalExcludedIds = []) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found for assignment.`);
    }

    // If booking was cancelled, stop assignment
    if (booking.status === "Cancelled") {
      return { success: false, reason: "Booking is cancelled." };
    }

    // Collect all mechanics who have already rejected this booking
    const alreadyRejected = (booking.rejectionHistory || []).map((r) =>
      r.mechanic.toString()
    );
    const combinedExcluded = Array.from(
      new Set([...alreadyRejected, ...additionalExcludedIds.map((id) => id.toString())])
    );

    // Retrieve eligible candidates
    const candidates = await getEligibleMechanics(combinedExcluded);

    if (candidates.length === 0) {
      // Escalation state: All mechanics unavailable or already rejected
      booking.assignmentStatus = "Escalated";
      booking.mechanic = null;
      booking.assignedMechanic = null;
      booking.assignmentHistory.push({
        action: "ESCALATED",
        timestamp: new Date(),
        assignedBy: "SYSTEM",
        notes: `No eligible mechanics available. ${
          combinedExcluded.length > 0
            ? `Excluded ${combinedExcluded.length} mechanic(s) due to previous rejections.`
            : "No active available mechanics."
        }`,
      });

      await booking.save();

      // Notify Admins
      const admins = await User.find({ role: "admin", isActive: true });
      for (const admin of admins) {
        await sendNotification(
          admin._id,
          "Booking Assignment Escalation",
          `Booking ${booking.bookingId} has no available mechanics to accept the work and requires manual assignment.`,
          "warning"
        ).catch(() => {});
      }

      return {
        success: false,
        escalated: true,
        message: "No eligible mechanics available; booking escalated to workshop admin.",
        booking,
      };
    }

    // Pick top candidate (lowest workload, tie-broken fairly)
    const selected = candidates[0];
    const selectedUserId = selected.user._id;

    // Concurrency check: Ensure offer belongs only to this mechanic
    booking.mechanic = selectedUserId;
    booking.assignedMechanic = selectedUserId;
    booking.assignmentStatus = "Pending Acceptance";
    booking.lastOfferedAt = new Date();

    booking.assignmentHistory.push({
      mechanic: selectedUserId,
      action: "OFFERED",
      timestamp: new Date(),
      assignedBy: "SYSTEM",
      notes: `Automated offer dispatched. Active workload: ${selected.workload}`,
    });

    await booking.save();

    // Update mechanic profile lastAssignedAt timestamp for future tie-breaking
    await Mechanic.findOneAndUpdate(
      { user: selectedUserId },
      { lastAssignedAt: new Date() }
    );

    // Notify mechanic of assignment offer
    await sendNotification(
      selectedUserId,
      "New Service Offer",
      `You have received a new service offer (${booking.bookingId}). Please accept or reject in your dashboard.`,
      "info"
    ).catch(() => {});

    return {
      success: true,
      escalated: false,
      mechanic: selected.user,
      workload: selected.workload,
      booking,
    };
  } catch (error) {
    console.error("Auto Assignment Error:", error);
    throw error;
  }
};

module.exports = {
  getActiveWorkloadForMechanic,
  getEligibleMechanics,
  assignNextEligibleMechanic,
};
