const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/publicContentAdminController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// All routes below are admin-only
router.use(protect, authorizeRoles("admin"));

// Admissions
router.get("/admissions", ctrl.getAdmissions);
router.post("/admissions", ctrl.updateAdmissions);

// Fee Structure
router.get("/fees", ctrl.getFees);
router.post("/fees", ctrl.updateFees);

// About School
router.get("/about", ctrl.getAbout);
router.post("/about", ctrl.updateAbout);

module.exports = router;
