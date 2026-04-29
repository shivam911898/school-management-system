const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    className: {
      type: String,
      required: [true, "Class is required"],
      trim: true,
      maxlength: 20,
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      uppercase: true,
      maxlength: 5,
    },
    rollNumber: {
      type: Number,
      required: [true, "Roll number is required"],
      min: 1,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required for password recovery"],
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

studentSchema.index(
  { className: 1, section: 1, rollNumber: 1 },
  { unique: true },
);
studentSchema.index({ name: 1 });

module.exports = mongoose.model("Student", studentSchema);
