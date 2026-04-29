const express = require('express');
const {
  markAttendance,
  getClassAttendance,
  getStudentAttendance,
  getClassAttendanceSummary,
  deleteAttendance,
  getTeacherAttendance,
  exportClassAttendanceCSV,
} = require('../controllers/attendanceController');
const { protect, requireTeacher, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Teacher and Admin routes
router.post('/mark', requireTeacher, markAttendance);
router.get('/class', requireTeacher, getClassAttendance);
router.get('/class/summary', requireTeacher, getClassAttendanceSummary);
router.get('/class/export', requireTeacher, exportClassAttendanceCSV);
router.get('/teacher', requireTeacher, getTeacherAttendance);

// Admin-only routes
router.delete('/:id', requireAdmin, deleteAttendance);

// Student and Teacher/Admin routes (with RBAC in controller)
router.get('/student/:studentId', getStudentAttendance);

module.exports = router;
