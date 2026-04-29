const mongoose = require("mongoose");

const AboutSchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    vision: { type: String, required: true },
    mission: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AboutSchool", AboutSchoolSchema);
