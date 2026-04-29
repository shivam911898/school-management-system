const express = require("express");
const {
  getRoleDashboardOverview,
  getDashboardMetrics,
  getClassDetails,
  getSystemHealth,
} = require("../controllers/dashboardController-simple");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Role-aware overview for admin/teacher/student
router.get("/overview", protect, getRoleDashboardOverview);

// All dashboard routes require authentication and admin role
router.use(protect);
router.use(requireAdmin);

// Main dashboard metrics
router.get("/metrics", getDashboardMetrics);

// Class-specific details
router.get("/class/:className", getClassDetails);

// System health and performance metrics
router.get("/health", getSystemHealth);

module.exports = router;
