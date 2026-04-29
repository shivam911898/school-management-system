const express = require("express");
const {
  bulkMarkAttendance,
  getFilteredAttendance,
  getStudentAttendanceEnhanced,
  updateAttendance,
  deleteAttendanceRecord,
} = require("../controllers/enhancedAttendanceController");
const {
  getClassAttendanceAnalytics,
  getStudentAttendanceAnalytics,
  getMonthlyTrends,
  getTopPerformingClasses,
  getLowAttendanceStudents,
  getAttendanceSummary,
} = require("../controllers/attendanceAnalyticsController");
const {
  protect,
  requireAdmin,
  requireTeacher,
} = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Bulk attendance marking (Teacher and Admin)
router.post("/bulk-mark", requireTeacher, bulkMarkAttendance);

// Get filtered attendance with advanced filtering
router.get("/", requireTeacher, getFilteredAttendance);

// Student-specific attendance
router.get("/student/:studentId", getStudentAttendanceEnhanced);

// Update/Delete attendance records
router.patch("/:attendanceId", requireTeacher, updateAttendance);
router.delete("/:attendanceId", requireAdmin, deleteAttendanceRecord);

// Analytics endpoints
router.get("/analytics/class", requireTeacher, getClassAttendanceAnalytics);
router.get(
  "/analytics/student/:studentId",
  requireTeacher,
  getStudentAttendanceAnalytics,
);
router.get("/analytics/trends", requireTeacher, getMonthlyTrends);
router.get("/analytics/top-classes", requireTeacher, getTopPerformingClasses);
router.get(
  "/analytics/low-attendance",
  requireTeacher,
  getLowAttendanceStudents,
);
router.get("/analytics/summary", requireTeacher, getAttendanceSummary);

module.exports = router;
