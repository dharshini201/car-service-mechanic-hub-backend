const sendEmail = require("../utils/sendEmail");
const {
  sendVehicleRegistrationEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusEmail,
  sendMechanicAssignmentEmail,
  sendCompletedServiceEmail,
  sendCancelledBookingEmail,
  sendPasswordResetEmail,
  sendContactNotificationEmail,
} = sendEmail;

/**
 * Adapter delegating to backend/utils/sendEmail.js
 */
const sendBookingConfirmationEmailWrapper = async ({ booking, customer, vehicle, service }) => {
  return await sendBookingConfirmationEmail({
    to: customer?.email || booking?.customer?.email,
    customerName: customer?.name || booking?.customer?.name,
    vehicle,
    vehicleNumber: vehicle?.vehicleNumber || booking?.vehicleNumber,
    service,
    bookingDate: booking?.bookingDate,
    bookingTime: booking?.bookingTime,
    status: booking?.status || "Pending",
    booking,
  });
};

const sendBookingStatusEmailWrapper = async ({ booking, customer, vehicle, service, status, mechanicNotes }) => {
  if (status === "Completed") {
    return await sendCompletedServiceEmail({
      to: customer?.email || booking?.customer?.email,
      customerName: customer?.name || booking?.customer?.name,
      vehicle,
      service,
      serviceDate: booking?.completedAt || new Date(),
      mechanicName: booking?.mechanic?.name,
      mechanicNotes: mechanicNotes || booking?.mechanicNotes,
      booking,
    });
  }

  if (status === "Cancelled") {
    return await sendCancelledBookingEmail({
      to: customer?.email || booking?.customer?.email,
      customerName: customer?.name || booking?.customer?.name,
      vehicle,
      service,
      bookingDate: booking?.bookingDate,
      bookingTime: booking?.bookingTime,
      status: "Cancelled",
      booking,
    });
  }

  return await sendBookingStatusEmail({
    to: customer?.email || booking?.customer?.email,
    customerName: customer?.name || booking?.customer?.name,
    vehicle,
    service,
    status,
    mechanicNotes: mechanicNotes || booking?.mechanicNotes,
    booking,
  });
};

const sendVehicleReadyEmailWrapper = async ({ booking, customer, vehicle, service, mechanicNotes }) => {
  return await sendCompletedServiceEmail({
    to: customer?.email || booking?.customer?.email,
    customerName: customer?.name || booking?.customer?.name,
    vehicle,
    service,
    serviceDate: booking?.completedAt || new Date(),
    mechanicName: booking?.mechanic?.name,
    mechanicNotes: mechanicNotes || booking?.mechanicNotes,
    booking,
  });
};

module.exports = {
  sendBookingConfirmationEmail: sendBookingConfirmationEmailWrapper,
  sendBookingStatusEmail: sendBookingStatusEmailWrapper,
  sendVehicleReadyEmail: sendVehicleReadyEmailWrapper,
  sendVehicleRegistrationEmail,
  sendMechanicAssignmentEmail,
  sendCompletedServiceEmail,
  sendCancelledBookingEmail,
  sendPasswordResetEmail,
  sendContactNotificationEmail,
};
