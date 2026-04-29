const express = require("express");
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getStudentsByClass,
  getTeachersBySubject,
  getMyProfile,
} = require("../controllers/userManagementController");
const {
  protect,
  requireAdmin,
  requireTeacher,
} = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  createManagedUserValidator,
} = require("../validators/userCreationValidators");
const { updateUserValidator } = require("../validators/userValidators");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Current user's own profile
router.get("/me/profile", getMyProfile);

// Admin-only routes
router.get("/", requireAdmin, getAllUsers);
router.post(
  "/",
  requireAdmin,
  createManagedUserValidator,
  validateRequest,
  createUser,
);
router.delete("/:id", requireAdmin, deleteUser);
router.patch("/:id/toggle-status", requireAdmin, toggleUserStatus);

// Teacher and Admin routes
router.get("/class/:className", requireTeacher, getStudentsByClass);
router.get("/teachers/subject/:subject", requireTeacher, getTeachersBySubject);

// Individual user routes (with RBAC)
router.get("/:id", getUserById);
router.patch("/:id", updateUserValidator, validateRequest, updateUser);

module.exports = router;
