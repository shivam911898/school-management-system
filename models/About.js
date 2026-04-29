const mongoose = require("mongoose");

const aboutSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, "About description is required"],
      trim: true,
      maxlength: 5000,
    },
    vision: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    mission: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    schoolName: {
      type: String,
      default: "J.C. Memorial School, Nagra, Ballia",
      trim: true,
      maxlength: 200,
    },
    heroImage: {
      type: String,
      default: "/images/school-banner.png",
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: "about",
  },
);

module.exports = mongoose.model("About", aboutSchema);
