const mongoose = require("mongoose");

const FeeStructureSchema = new mongoose.Schema(
  {
    structure: [
      {
        class: String,
        admission: Number,
        tuition: Number,
        annual: Number,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("FeeStructure", FeeStructureSchema);
