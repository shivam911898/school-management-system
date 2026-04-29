const mongoose = require("mongoose");

const AdmissionsInfoSchema = new mongoose.Schema(
  {
    startDate: { type: String, required: true },
    process: { type: [String], required: true },
    requiredDocuments: { type: [String], required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AdmissionsInfo", AdmissionsInfoSchema);
