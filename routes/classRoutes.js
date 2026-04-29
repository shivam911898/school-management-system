const express = require("express");
const {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  getClassStudents,
  assignClassTeacher,
  addSubjectToClass,
  getClassSchedule,
} = require("../controllers/classController");
const {
  protect,
  requireAdmin,
  requireTeacher,
} = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin-only routes
router.post("/", requireAdmin, createClass);
router.delete("/:id", requireAdmin, deleteClass);
router.patch("/:id", requireAdmin, updateClass);
router.patch("/:id/assign-teacher", requireAdmin, assignClassTeacher);
router.patch("/:id/add-subject", requireAdmin, addSubjectToClass);

// Teacher and Admin routes
router.get("/", requireTeacher, getAllClasses);
router.get("/:id", requireTeacher, getClassById);
router.get("/:id/students", requireTeacher, getClassStudents);
router.get("/:id/schedule", requireTeacher, getClassSchedule);

module.exports = router;
