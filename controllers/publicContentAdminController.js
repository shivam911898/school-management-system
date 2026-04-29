const AdmissionsInfo = require("../models/AdmissionsInfo");
const FeeStructure = require("../models/FeeStructure");
const AboutSchool = require("../models/AboutSchool");

// --- Admissions ---
exports.getAdmissions = async (req, res) => {
  const doc = await AdmissionsInfo.findOne();
  if (!doc)
    return res
      .status(404)
      .json({ success: false, message: "No admissions info found" });
  res.json(doc);
};
exports.updateAdmissions = async (req, res) => {
  const { startDate, process, requiredDocuments } = req.body;
  let doc = await AdmissionsInfo.findOne();
  if (!doc) doc = new AdmissionsInfo();
  doc.startDate = startDate;
  doc.process = process;
  doc.requiredDocuments = requiredDocuments;
  await doc.save();
  res.json({ success: true, doc });
};

// --- Fee Structure ---
exports.getFees = async (req, res) => {
  const doc = await FeeStructure.findOne();
  if (!doc)
    return res
      .status(404)
      .json({ success: false, message: "No fee structure found" });
  res.json(doc);
};
exports.updateFees = async (req, res) => {
  const { structure } = req.body;
  let doc = await FeeStructure.findOne();
  if (!doc) doc = new FeeStructure();
  doc.structure = structure;
  await doc.save();
  res.json({ success: true, doc });
};

// --- About School ---
exports.getAbout = async (req, res) => {
  const doc = await AboutSchool.findOne();
  if (!doc)
    return res
      .status(404)
      .json({ success: false, message: "No about info found" });
  res.json(doc);
};
exports.updateAbout = async (req, res) => {
  const { name, description, vision, mission } = req.body;
  let doc = await AboutSchool.findOne();
  if (!doc) doc = new AboutSchool();
  doc.name = name;
  doc.description = description;
  doc.vision = vision;
  doc.mission = mission;
  await doc.save();
  res.json({ success: true, doc });
};
