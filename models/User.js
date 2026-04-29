const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "student",
    },
    // Additional fields for different roles
    // BUG FIX #8: employeeId is kept for legacy compatibility but teacherId is the canonical field.
    // Both fields are set to the same value for teachers in the identity service.
    // Removed duplicate unique constraint conflicts by keeping employeeId non-unique (legacy alias only).
    employeeId: {
      type: String,
      sparse: true,
      // Not unique here — teacherId is the unique canonical field for teachers.
      // employeeId is a legacy alias and should equal teacherId for all teachers.
    },
    teacherId: {
      type: String,
      sparse: true,
      unique: true,
      required: function () {
        return this.role === "teacher";
      },
    },
    studentId: {
      type: String,
      sparse: true,
      unique: true,
      required: function () {
        return this.role === "student";
      },
    },
    class: {
      type: String,
      required: function () {
        return this.role === "student";
      },
    },
    subjects: [
      {
        type: String,
        required: function () {
          return this.role === "teacher";
        },
      },
    ],
    phone: {
      type: String,
      trim: true,
      required: [true, "Phone number is required for password recovery"],
    },
    address: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: function () {
        return this.role === "student";
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    fcmTokens: [
      {
        type: String,
        trim: true,
      },
    ],
    passwordResetToken: {
      type: String,
      trim: true,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function savePassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
