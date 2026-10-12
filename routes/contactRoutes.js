const express = require("express");

const {
  createContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
} = require("../controllers/contactController");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const rateLimit = require("../middleware/rateLimitMiddleware");

const contactSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many contact messages submitted. Please try again later.",
});

const router = express.Router();

// ================= CREATE CONTACT MESSAGE (PUBLIC) =================

router.post("/", contactSubmitLimiter, createContact);

// ================= ADMIN CONTACT MANAGEMENT (PROTECTED) =================

router.get("/", protect, adminOnly, getAllContacts);

router.get("/:contactId", protect, adminOnly, getContactById);

router.put("/:contactId/status", protect, adminOnly, updateContactStatus);

router.delete("/:contactId", protect, adminOnly, deleteContact);

module.exports = router;