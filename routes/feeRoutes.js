const express = require("express");
const {
  getAllFees,
  getFeeByClass,
  createFee,
  updateFee,
  deleteFee,
} = require("../controllers/feeController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Public read — anyone (including unauthenticated visitors) can view fees
router.get("/", getAllFees);
router.get("/class/:className", getFeeByClass);

// Admin writes
router.post("/", protect, requireAdmin, createFee);
router.put("/:id", protect, requireAdmin, updateFee);
router.delete("/:id", protect, requireAdmin, deleteFee);

module.exports = router;
