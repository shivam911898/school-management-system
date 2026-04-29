const express = require("express");
const router = express.Router();
const {
  createAdmission,
  updateAdmission,
  deleteAdmission,
  listAdmissions,
  createFee,
  updateFee,
  deleteFee,
  listFees,
  getAboutAdmin,
  updateAbout,
  setNoticePublic,
} = require("../controllers/adminPublicContentController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

// Admissions
router.get("/admissions", protect, requireAdmin, listAdmissions);
router.post("/admissions", protect, requireAdmin, createAdmission);
router.put("/admissions/:id", protect, requireAdmin, updateAdmission);
router.delete("/admissions/:id", protect, requireAdmin, deleteAdmission);

// Fees
router.get("/fees", protect, requireAdmin, listFees);
router.post("/fees", protect, requireAdmin, createFee);
router.put("/fees/:id", protect, requireAdmin, updateFee);
router.delete("/fees/:id", protect, requireAdmin, deleteFee);

// About
router.get("/about", protect, requireAdmin, getAboutAdmin);
router.put("/about", protect, requireAdmin, updateAbout);

// Notices public visibility
router.put("/notices/:id/public", protect, requireAdmin, setNoticePublic);

module.exports = router;
