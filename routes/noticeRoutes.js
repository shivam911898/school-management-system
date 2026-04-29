const express = require("express");
const {
  getNotices,
  createNotice,
  updateNotice,
  deleteNotice,
} = require("../controllers/noticeController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { noticeValidator } = require("../validators/noticeValidators");

const router = express.Router();

router.get("/", protect, getNotices);
router.post(
  "/",
  protect,
  requireAdmin,
  noticeValidator,
  validateRequest,
  createNotice,
);
router.put(
  "/:id",
  protect,
  requireAdmin,
  noticeValidator,
  validateRequest,
  updateNotice,
);
router.delete("/:id", protect, requireAdmin, deleteNotice);

module.exports = router;
