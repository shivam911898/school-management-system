const Fee = require("../models/Fee");

// Get all fees (public / any authenticated user)
const getAllFees = async (req, res, next) => {
  try {
    const fees = await Fee.find().sort({ className: 1 });
    res.status(200).json({ success: true, count: fees.length, data: fees });
  } catch (error) {
    next(error);
  }
};

// Get fee by class name
const getFeeByClass = async (req, res, next) => {
  try {
    const { className } = req.params;
    const fee = await Fee.findOne({ className });
    if (!fee) {
      return res
        .status(404)
        .json({ success: false, message: "Fee structure not found for this class" });
    }
    res.status(200).json({ success: true, data: fee });
  } catch (error) {
    next(error);
  }
};

// Create fee structure (admin only)
const createFee = async (req, res, next) => {
  try {
    const { className, amount, details } = req.body;

    const existing = await Fee.findOne({ className });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Fee structure for this class already exists. Use PUT to update.",
      });
    }

    const fee = await Fee.create({ className, amount, details });
    res.status(201).json({ success: true, message: "Fee structure created", data: fee });
  } catch (error) {
    next(error);
  }
};

// Update fee structure (admin only)
const updateFee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, details } = req.body;

    const fee = await Fee.findByIdAndUpdate(
      id,
      { amount, details },
      { new: true, runValidators: true }
    );

    if (!fee) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }

    res.status(200).json({ success: true, message: "Fee structure updated", data: fee });
  } catch (error) {
    next(error);
  }
};

// Delete fee structure (admin only)
const deleteFee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fee = await Fee.findByIdAndDelete(id);
    if (!fee) {
      return res.status(404).json({ success: false, message: "Fee structure not found" });
    }
    res.status(200).json({ success: true, message: "Fee structure deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllFees, getFeeByClass, createFee, updateFee, deleteFee };
