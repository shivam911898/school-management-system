const express = require("express");
const {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/studentController");
const {
  protect,
  requireAdmin,
  requireTeacher,
} = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { studentValidator } = require("../validators/studentValidators");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(requireTeacher, getStudents)
  .post(requireAdmin, studentValidator, validateRequest, createStudent);
router
  .route("/:id")
  .put(requireAdmin, studentValidator, validateRequest, updateStudent)
  .delete(requireAdmin, deleteStudent);

module.exports = router;
