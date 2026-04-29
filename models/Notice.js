const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 2000,
    },
    date: {
      type: Date,
      required: [true, "Notice date is required"],
    },
    type: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
    },
    targetAudience: {
      type: String,
      enum: ["student", "teacher", "all"],
      default: "all",
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
      default: "normal",
    },
    notification: {
      prepared: {
        type: Boolean,
        default: false,
      },
      channel: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["pending", "queued", "sent", "failed", null],
        default: null,
      },
      preparedAt: {
        type: Date,
        default: null,
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
      description: "If true, notice is visible on public site.",
    },
  },
  {
    timestamps: true,
  },
);

noticeSchema.index({ date: -1, createdAt: -1 });

module.exports = mongoose.model("Notice", noticeSchema);
