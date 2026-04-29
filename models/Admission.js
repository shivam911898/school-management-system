const mongoose = require("mongoose");

const admissionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Admission title is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, "Admission description is required"],
      trim: true,
      maxlength: 2000,
    },
    startDate: {
      type: Date,
      required: [true, "Admission start date is required"],
    },
    requirements: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "admissions",
  },
);

admissionSchema.index({ startDate: -1, createdAt: -1 });

module.exports = mongoose.model("Admission", admissionSchema);
