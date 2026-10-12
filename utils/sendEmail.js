const nodemailer = require("nodemailer");

/**
 * Resolves email credentials with automatic Google App Password precedence.
 * Strips any spaces often copied from Google Account security (e.g., 'qjid ynxt klxk vqzt').
 */
const resolveCredentials = () => {
  const user = (process.env.EMAIL_USER || "").trim();
  const rawPass1 = (process.env.EMAIL_PASS || "").trim();
  const rawPass2 = (process.env.EMAIL_PASSWORD || "").trim();

  const cleanPass1 = rawPass1.replace(/\s+/g, "");
  const cleanPass2 = rawPass2.replace(/\s+/g, "");

  // Prioritize 16-character App Password if present
  let pass = "";
  if (cleanPass1.length === 16) {
    pass = cleanPass1;
  } else if (cleanPass2.length === 16) {
    pass = cleanPass2;
  } else {
    pass = cleanPass1 || cleanPass2;
  }

  return { user, pass };
};

/**
 * Creates a configured Nodemailer transporter using environment variables.
 */
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.EMAIL_PORT
    ? parseInt(process.env.EMAIL_PORT, 10)
    : process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : 587;
  const { user, pass } = resolveCredentials();

  const isGmail =
    process.env.EMAIL_SERVICE?.toLowerCase() === "gmail" ||
    host.toLowerCase().includes("gmail") ||
    user.toLowerCase().endsWith("@gmail.com");

  if (user && pass) {
    if (isGmail) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Fallback simulator transporter when credentials are not yet configured in .env
  return {
    isSimulated: true,
    sendMail: async (mailOptions) => {
      console.log("--------------------------------------------------");
      console.log("📨 [SIMULATED EMAIL DISPATCH - MRT Car Service]");
      console.log(`To: ${mailOptions.to}`);
      console.log(`From: ${mailOptions.from}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log("--------------------------------------------------");
      console.log(mailOptions.text || "(HTML version provided)");
      console.log("--------------------------------------------------");
      console.log("Notice: Set EMAIL_USER & EMAIL_PASS in backend/.env to send real Gmail emails.");
      console.log("--------------------------------------------------");
      return { messageId: `simulated-${Date.now()}` };
    },
  };
};

/**
 * Verifies the SMTP transporter connection with the mail server
 */
const verifyEmailConfig = async () => {
  const { user, pass } = resolveCredentials();

  if (!user || !pass) {
    return {
      configured: false,
      message:
        "Gmail credentials (EMAIL_USER and EMAIL_PASS) are not configured in backend/.env.",
    };
  }

  try {
    const transporter = createTransporter();
    if (transporter.isSimulated || !transporter.verify) {
      return {
        configured: false,
        message: "Transporter is running in simulated mode. Missing credentials.",
      };
    }
    await transporter.verify();
    return {
      configured: true,
      message: `SMTP connection established successfully for ${user}.`,
    };
  } catch (error) {
    return {
      configured: false,
      error: error.message,
      message: `Gmail SMTP authentication failed: ${error.message}. Ensure 2-Step Verification is active and use a 16-character App Password from Google Account Security.`,
    };
  }
};

/**
 * Reusable HTML template builder for MRT Car Service emails
 */
const formatEmailHtml = ({ recipientName, heading, intro, details = [], actionNote, message }) => {
  const detailsRows = details
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 14px; font-weight: 600; color: #475569; width: 38%; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${item.label}:</td>
          <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500;">${item.value}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${heading}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0b1120 0%, #1e293b 100%); padding: 28px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">MRT Car Service</h1>
            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Car Service &amp; Mechanic Hub</p>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding: 32px 28px;">
            <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600;">${heading}</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
              Dear <strong>${recipientName || "Customer"}</strong>,
            </p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              ${intro}
            </p>

            ${
              details.length > 0
                ? `
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                  ${detailsRows}
                </table>
              `
                : ""
            }

            ${
              message
                ? `<div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0; color: #1e40af; font-size: 14px; line-height: 1.5;">${message}</div>`
                : ""
            }

            ${
              actionNote
                ? `<p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${actionNote}</p>`
                : ""
            }

            <p style="color: #1e293b; font-size: 14px; margin-bottom: 4px; font-weight: 600;">
              Thank you,<br>
              <span style="color: #2563eb;">MRT Car Service</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
              This is an automated notification from MRT Car Service. Please do not reply directly to this email.<br>
              For assistance, visit your customer dashboard or contact workshop support.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Core sendEmail function using Nodemailer.
 */
const sendEmail = async (optionsOrTo, subjectArg, htmlArg, textArg) => {
  let to, subject, html, text;

  if (typeof optionsOrTo === "object" && optionsOrTo !== null) {
    to = optionsOrTo.to;
    subject = optionsOrTo.subject;
    text = optionsOrTo.text;

    if (optionsOrTo.html) {
      html = optionsOrTo.html;
    } else if (optionsOrTo.heading || optionsOrTo.intro) {
      html = formatEmailHtml({
        recipientName: optionsOrTo.recipientName,
        heading: optionsOrTo.heading || subject,
        intro: optionsOrTo.intro || "",
        details: optionsOrTo.details || [],
        actionNote: optionsOrTo.actionNote || "",
        message: optionsOrTo.message || "",
      });
    }
  } else {
    to = optionsOrTo;
    subject = subjectArg;
    html = htmlArg;
    text = textArg;
  }

  if (!to) {
    throw new Error("Recipient email address (to) is required.");
  }

  const transporter = createTransporter();
  const { user: emailUser } = resolveCredentials();
  const isGmailAuth =
    process.env.EMAIL_SERVICE?.toLowerCase() === "gmail" ||
    (process.env.EMAIL_HOST || "").toLowerCase().includes("gmail") ||
    emailUser.toLowerCase().endsWith("@gmail.com");

  let from = process.env.EMAIL_FROM;
  if (!from || isGmailAuth) {
    from = `"MRT Car Service" <${emailUser || "no-reply@mrtcservice.com"}>`;
  }

  const mailOptions = {
    from,
    to,
    replyTo: emailUser || undefined,
    subject,
    text: text || "You have a new update from MRT Car Service.",
    html: html || `<p>${text || "You have a new update from MRT Car Service."}</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ [EmailService] Sent to "${to}" | Subject: "${subject}" | MsgID: ${info.messageId}`
    );
    return info;
  } catch (error) {
    console.error(
      `❌ [EmailService] Failed to send email to "${to}" | Subject: "${subject}":`,
      error.message
    );
    throw error;
  }
};

// ==========================================================
// 1. VEHICLE REGISTRATION EMAIL
// ==========================================================
const sendVehicleRegistrationEmail = async ({ to, customerName, vehicle }) => {
  const subject = "Vehicle Registered Successfully - MRT Car Service";
  const intro = "Your vehicle has been successfully registered with MRT Car Service.";
  const details = [
    { label: "Brand", value: vehicle.brand },
    { label: "Model", value: vehicle.model },
    { label: "Vehicle Number", value: vehicle.vehicleNumber },
    { label: "Year", value: vehicle.year },
    { label: "Fuel Type", value: vehicle.fuelType },
  ];
  const actionNote = "You can now use this vehicle to book our services.";
  const text = `Dear ${customerName || "Customer"},

Your vehicle has been successfully registered with MRT Car Service.

Vehicle Details:

Brand: ${vehicle.brand}
Model: ${vehicle.model}
Vehicle Number: ${vehicle.vehicleNumber}
Year: ${vehicle.year}
Fuel Type: ${vehicle.fuelType}

You can now use this vehicle to book our services.

Thank you,
MRT Car Service`;

  return await sendEmail({
    to,
    subject,
    recipientName: customerName,
    heading: "Vehicle Registered Successfully",
    intro,
    details,
    actionNote,
    text,
  });
};

// ==========================================================
// 2. BOOKING CONFIRMATION EMAIL
// ==========================================================
const sendBookingConfirmationEmail = async ({
  to,
  customerName,
  vehicle,
  vehicleNumber,
  service,
  bookingDate,
  bookingTime,
  status = "Pending",
  booking,
}) => {
  const recipientEmail = to || booking?.customer?.email;
  const name = customerName || booking?.customer?.name || "Customer";
  const vehStr = vehicle
    ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
    : booking?.vehicleModel || "Vehicle";
  const vehNum = vehicleNumber || vehicle?.vehicleNumber || booking?.vehicleNumber || "N/A";
  const srvName = service?.name || booking?.serviceType || booking?.service?.name || "Car Service";
  const bDate = bookingDate
    ? new Date(bookingDate).toLocaleDateString()
    : booking?.bookingDate
    ? new Date(booking?.bookingDate).toLocaleDateString()
    : "Scheduled Date";
  const bTime = bookingTime || booking?.bookingTime || "Scheduled Time";

  const subject = "Service Booking Confirmed - MRT Car Service";
  const intro = "Your service booking has been successfully created.";
  const details = [
    { label: "Customer Name", value: name },
    { label: "Vehicle", value: vehStr },
    { label: "Vehicle Number", value: vehNum },
    { label: "Service", value: srvName },
    { label: "Booking Date", value: bDate },
    { label: "Booking Time", value: bTime },
    { label: "Booking Status", value: status },
  ];

  const text = `Dear ${name},

Your service booking has been successfully created.

Customer Name: ${name}
Vehicle: ${vehStr}
Vehicle Number: ${vehNum}
Service: ${srvName}
Booking Date: ${bDate}
Booking Time: ${bTime}
Booking Status: ${status}

Status:
${status}

Thank you,
MRT Car Service`;

  return await sendEmail({
    to: recipientEmail,
    subject,
    recipientName: name,
    heading: "Service Booking Confirmed",
    intro,
    details,
    text,
  });
};

// ==========================================================
// 3. BOOKING STATUS EMAILS (Pending, In Progress, Confirmed, etc.)
// ==========================================================
const sendBookingStatusEmail = async ({
  to,
  customerName,
  vehicle,
  service,
  status,
  mechanicNotes,
  booking,
}) => {
  const recipientEmail = to || booking?.customer?.email;
  const name = customerName || booking?.customer?.name || "Customer";
  const vehStr = vehicle
    ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
    : booking?.vehicleModel || "Vehicle";
  const srvName = service?.name || booking?.serviceType || booking?.service?.name || "General Service";

  const subject = "Service Status Updated - MRT Car Service";
  const intro = "Your vehicle service booking status has been updated.";
  const details = [
    { label: "Vehicle", value: vehStr },
    { label: "Service", value: srvName },
    { label: "Status", value: status },
    ...(mechanicNotes ? [{ label: "Notes", value: mechanicNotes }] : []),
  ];

  const text = `Dear Customer,

Your vehicle service booking status has been updated.

Vehicle:
${vehStr}

Service:
${srvName}

Status:
${status}
${mechanicNotes ? `\nMechanic Notes:\n${mechanicNotes}\n` : ""}
Thank you,
MRT Car Service`;

  return await sendEmail({
    to: recipientEmail,
    subject,
    recipientName: name,
    heading: "Service Status Updated",
    intro,
    details,
    text,
  });
};

// ==========================================================
// 4. MECHANIC ASSIGNMENT EMAIL
// ==========================================================
const sendMechanicAssignmentEmail = async ({
  to,
  customerName,
  vehicle,
  service,
  mechanicName,
  bookingDate,
  bookingTime,
  booking,
}) => {
  const recipientEmail = to || booking?.customer?.email;
  const name = customerName || booking?.customer?.name || "Customer";
  const vehStr = vehicle
    ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
    : booking?.vehicleModel || "Vehicle";
  const srvName = service?.name || booking?.serviceType || booking?.service?.name || "General Service";
  const mName = mechanicName || booking?.mechanic?.name || "Certified Technician";
  const bDate = bookingDate
    ? new Date(bookingDate).toLocaleDateString()
    : booking?.bookingDate
    ? new Date(booking?.bookingDate).toLocaleDateString()
    : "Scheduled Date";
  const bTime = bookingTime || booking?.bookingTime || "Scheduled Time";

  const subject = "Mechanic Assigned - MRT Car Service";
  const intro = "A certified mechanic has been assigned to your vehicle service booking.";
  const details = [
    { label: "Customer Name", value: name },
    { label: "Vehicle", value: vehStr },
    { label: "Service", value: srvName },
    { label: "Mechanic Name", value: mName },
    { label: "Booking Date", value: bDate },
    { label: "Booking Time", value: bTime },
  ];

  const text = `Dear ${name},

A certified mechanic has been assigned to your service booking.

Customer Name: ${name}
Vehicle: ${vehStr}
Service: ${srvName}
Mechanic Name: ${mName}
Booking Date: ${bDate}
Booking Time: ${bTime}

Thank you,
MRT Car Service`;

  return await sendEmail({
    to: recipientEmail,
    subject,
    recipientName: name,
    heading: "Mechanic Assigned",
    intro,
    details,
    text,
  });
};

// ==========================================================
// 5. COMPLETED SERVICE EMAIL
// ==========================================================
const sendCompletedServiceEmail = async ({
  to,
  customerName,
  vehicle,
  service,
  serviceDate,
  mechanicName,
  mechanicNotes,
  booking,
}) => {
  const recipientEmail = to || booking?.customer?.email;
  const name = customerName || booking?.customer?.name || "Customer";
  const vehStr = vehicle
    ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
    : booking?.vehicleModel || "Vehicle";
  const srvName = service?.name || booking?.serviceType || booking?.service?.name || "General Service";
  const sDate = serviceDate
    ? new Date(serviceDate).toLocaleDateString()
    : new Date().toLocaleDateString();
  const mName = mechanicName || booking?.mechanic?.name || "Assigned Mechanic";
  const notes = mechanicNotes || booking?.mechanicNotes || "All scheduled service points completed.";

  const subject = "Service Completed - MRT Car Service";
  const intro = "Your vehicle service has been successfully completed.";
  const details = [
    { label: "Customer Name", value: name },
    { label: "Vehicle", value: vehStr },
    { label: "Service", value: srvName },
    { label: "Service Date", value: sDate },
    { label: "Mechanic", value: mName },
    { label: "Mechanic Notes", value: notes },
  ];

  const text = `Dear ${name},

Your vehicle service has been completed.

Customer Name: ${name}
Vehicle: ${vehStr}
Service: ${srvName}
Service Date: ${sDate}
Mechanic: ${mName}
Mechanic Notes: ${notes}

Thank you,
MRT Car Service`;

  return await sendEmail({
    to: recipientEmail,
    subject,
    recipientName: name,
    heading: "Service Completed",
    intro,
    details,
    actionNote: "Your vehicle is ready. Thank you for choosing MRT Car Service.",
    text,
  });
};

// ==========================================================
// 6. CANCELLED BOOKING EMAIL
// ==========================================================
const sendCancelledBookingEmail = async ({
  to,
  customerName,
  vehicle,
  service,
  bookingDate,
  bookingTime,
  status = "Cancelled",
  booking,
}) => {
  const recipientEmail = to || booking?.customer?.email;
  const name = customerName || booking?.customer?.name || "Customer";
  const vehStr = vehicle
    ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
    : booking?.vehicleModel || "Vehicle";
  const srvName = service?.name || booking?.serviceType || booking?.service?.name || "General Service";
  const bDate = bookingDate
    ? new Date(bookingDate).toLocaleDateString()
    : booking?.bookingDate
    ? new Date(booking?.bookingDate).toLocaleDateString()
    : "Original Date";
  const bTime = bookingTime || booking?.bookingTime || "Original Time";

  const subject = "Service Booking Cancelled - MRT Car Service";
  const intro = "Your vehicle service booking has been cancelled.";
  const details = [
    { label: "Customer Name", value: name },
    { label: "Vehicle", value: vehStr },
    { label: "Service", value: srvName },
    { label: "Original Booking Date", value: bDate },
    { label: "Original Booking Time", value: bTime },
    { label: "Status", value: status },
  ];

  const text = `Dear ${name},

Your vehicle service booking has been cancelled.

Customer Name: ${name}
Vehicle: ${vehStr}
Service: ${srvName}
Original Booking Date: ${bDate}
Original Booking Time: ${bTime}
Status: ${status}

Thank you,
MRT Car Service`;

  return await sendEmail({
    to: recipientEmail,
    subject,
    recipientName: name,
    heading: "Service Booking Cancelled",
    intro,
    details,
    actionNote: "You can schedule a new booking anytime from your customer dashboard.",
    text,
  });
};

// ==========================================================
// 7. PASSWORD RESET EMAIL
// ==========================================================
const sendPasswordResetEmail = async ({
  to,
  name = "Valued Customer",
  resetUrl,
  expiresMinutes = 60,
}) => {
  const subject = "Password Reset Request - MRT Car Service";
  const intro = `We received a request to reset your password for your MRT Car Service account. This link will expire in ${expiresMinutes} minutes. If you did not make this request, you can safely ignore this email.`;
  const details = [
    { label: "Account Email", value: to },
    { label: "Valid For", value: `${expiresMinutes} minutes` },
    { label: "Security Notice", value: "Do not share this link with anyone" },
  ];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Request</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0b1120 0%, #1e293b 100%); padding: 28px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">MRT Car Service</h1>
            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Car Service &amp; Mechanic Hub</p>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding: 32px 28px;">
            <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600;">Password Reset Request</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
              Dear <strong>${name}</strong>,
            </p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              ${intro}
            </p>

            <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 24px; border: 1px solid #e2e8f0;">
              <tr>
                <td style="padding: 10px 14px; font-weight: 600; color: #475569; width: 38%; border-bottom: 1px solid #e2e8f0; font-size: 14px;">Account Email:</td>
                <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500;">${to}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; font-weight: 600; color: #475569; width: 38%; font-size: 14px;">Link Validity:</td>
                <td style="padding: 10px 14px; color: #0f172a; font-size: 14px; font-weight: 500;">${expiresMinutes} minutes</td>
              </tr>
            </table>

            <!-- Reset Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
                Reset Password
              </a>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.5; word-break: break-all; margin-bottom: 24px;">
              If the button does not work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
            </p>

            <p style="color: #1e293b; font-size: 14px; margin-bottom: 4px; font-weight: 600;">
              Thank you,<br>
              <span style="color: #2563eb;">MRT Car Service Team</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
              If you did not request this password reset, please ignore this email.<br>
              Your password will remain unchanged.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Dear ${name},

We received a request to reset your password for your MRT Car Service account.

Please visit the link below to set a new password:
${resetUrl}

This link is valid for ${expiresMinutes} minutes. If you did not request a password reset, you can safely ignore this email.

Thank you,
MRT Car Service Team`;

  return await sendEmail({
    to,
    subject,
    recipientName: name,
    heading: "Password Reset Request",
    intro,
    details,
    actionNote: `Reset your password: ${resetUrl}`,
    html,
    text,
  });
};

// ==========================================================
// 8. CONTACT FORM NOTIFICATION EMAIL
// ==========================================================
const sendContactNotificationEmail = async ({
  name,
  email,
  phone,
  subject: contactSubject,
  message,
}) => {
  const { user } = resolveCredentials();
  const adminEmail = process.env.ADMIN_EMAIL || user || "support@carservicehub.com";

  // Notification to admin
  const adminSubject = `[Inquiry] ${contactSubject} - from ${name}`;
  await sendEmail({
    to: adminEmail,
    subject: adminSubject,
    recipientName: "MRT Workshop Admin",
    heading: "New Contact Form Inquiry",
    intro: `A customer has sent an inquiry through the MRT Car Service contact page.`,
    details: [
      { label: "Customer Name", value: name },
      { label: "Customer Email", value: email },
      { label: "Customer Phone", value: phone || "Not provided" },
      { label: "Subject", value: contactSubject },
      { label: "Message", value: message },
    ],
    actionNote: "Please reply to this customer at your earliest convenience.",
    text: `New contact submission from ${name} (${email}, ${phone}):\n\nSubject: ${contactSubject}\nMessage: ${message}`,
  });

  // Acknowledgment to customer
  if (email) {
    try {
      await sendEmail({
        to: email,
        subject: "We received your message - MRT Car Service",
        recipientName: name,
        heading: "Message Received",
        intro: "Thank you for contacting MRT Car Service. Our support team has received your message and will get back to you shortly.",
        details: [
          { label: "Subject", value: contactSubject },
          { label: "Your Message", value: message },
        ],
        actionNote: "For urgent assistance, please call our workshop directly at our customer care number.",
        text: `Dear ${name},\n\nThank you for reaching out to MRT Car Service. We have received your inquiry regarding "${contactSubject}" and will get back to you shortly.\n\nBest regards,\nMRT Car Service Team`,
      });
    } catch (ackErr) {
      console.warn("Could not send contact ack email to user:", ackErr.message);
    }
  }
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.createTransporter = createTransporter;
module.exports.verifyEmailConfig = verifyEmailConfig;
module.exports.sendVehicleRegistrationEmail = sendVehicleRegistrationEmail;
module.exports.sendBookingConfirmationEmail = sendBookingConfirmationEmail;
module.exports.sendBookingStatusEmail = sendBookingStatusEmail;
module.exports.sendMechanicAssignmentEmail = sendMechanicAssignmentEmail;
module.exports.sendCompletedServiceEmail = sendCompletedServiceEmail;
module.exports.sendCancelledBookingEmail = sendCancelledBookingEmail;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
module.exports.sendContactNotificationEmail = sendContactNotificationEmail;
