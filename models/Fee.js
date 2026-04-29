const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
      maxlength: 60,
    },
    amount: {
      type: Number,
      required: [true, "Fee amount is required"],
      min: [0, "Fee amount cannot be negative"],
    },
    details: {
      type: String,
      required: [true, "Fee details are required"],
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: "fees",
  },
);

feeSchema.index({ className: 1 }, { unique: true });

module.exports = mongoose.model("Fee", feeSchema);
