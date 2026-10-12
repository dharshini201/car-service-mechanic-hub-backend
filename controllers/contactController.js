const Contact = require("../models/contact");
const { sendContactNotificationEmail } = require("../utils/sendEmail");

// ================= CREATE CONTACT MESSAGE =================

const createContact = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      subject,
      message,
    } = req.body;

    // Validation
    if (
      !name ||
      !email ||
      !phone ||
      !subject ||
      !message
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Create contact message
    const contact = await Contact.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });

    // Send email notification to admin & confirmation to user asynchronously
    sendContactNotificationEmail({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      subject: contact.subject,
      message: contact.message,
    }).catch((mailErr) => {
      console.warn("Contact form notification email failed:", mailErr.message);
    });

    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully. We will contact you soon.",
      contact,
    });
  } catch (error) {
    console.error("Create Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while sending your message.",
    });
  }
};

// ================= GET ALL CONTACT MESSAGES =================

const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error("Get Contacts Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching contact messages.",
    });
  }
};

// ================= GET SINGLE CONTACT =================

const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(
      req.params.contactId
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    res.status(200).json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error("Get Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching contact message.",
    });
  }
};

// ================= UPDATE CONTACT STATUS =================

const updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["New", "Read", "Replied"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact status.",
      });
    }

    const contact = await Contact.findById(
      req.params.contactId
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    contact.status = status;

    await contact.save();

    res.status(200).json({
      success: true,
      message: "Contact status updated successfully.",
      contact,
    });
  } catch (error) {
    console.error("Update Contact Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating contact status.",
    });
  }
};

// ================= DELETE CONTACT =================

const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(
      req.params.contactId
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    await Contact.findByIdAndDelete(contact._id);

    res.status(200).json({
      success: true,
      message: "Contact message deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting contact message.",
    });
  }
};

module.exports = {
  createContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
};