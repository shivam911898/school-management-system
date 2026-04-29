const Admission = require("../models/Admission");
const Fee = require("../models/Fee");
const About = require("../models/About");

const toRequirements = (value) => {
  if (Array.isArray(value))
    return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

// Admissions CRUD
exports.createAdmission = async (req, res, next) => {
  try {
    const { title, description, startDate, requirements } = req.body;
    const admission = await Admission.create({
      title,
      description,
      startDate,
      requirements: toRequirements(requirements),
    });

    res.status(201).json({ success: true, admission });
  } catch (error) {
    next(error);
  }
};

exports.updateAdmission = async (req, res, next) => {
  try {
    const { title, description, startDate, requirements } = req.body;
    const admission = await Admission.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        startDate,
        requirements: toRequirements(requirements),
      },
      { new: true, runValidators: true },
    );

    if (!admission) {
      return res
        .status(404)
        .json({ success: false, message: "Admission not found" });
    }

    res.json({ success: true, admission });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdmission = async (req, res, next) => {
  try {
    const deleted = await Admission.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Admission not found" });
    }
    res.json({ success: true, message: "Admission deleted" });
  } catch (error) {
    next(error);
  }
};

exports.listAdmissions = async (_req, res, next) => {
  try {
    const admissions = await Admission.find().sort({
      startDate: -1,
      createdAt: -1,
    });
    res.json({ success: true, count: admissions.length, admissions });
  } catch (error) {
    next(error);
  }
};

// Fees CRUD
exports.createFee = async (req, res, next) => {
  try {
    const { className, amount, details } = req.body;
    const fee = await Fee.create({ className, amount, details });
    res.status(201).json({ success: true, fee });
  } catch (error) {
    next(error);
  }
};

exports.updateFee = async (req, res, next) => {
  try {
    const { className, amount, details } = req.body;
    const fee = await Fee.findByIdAndUpdate(
      req.params.id,
      { className, amount, details },
      { new: true, runValidators: true },
    );

    if (!fee) {
      return res
        .status(404)
        .json({ success: false, message: "Fee record not found" });
    }

    res.json({ success: true, fee });
  } catch (error) {
    next(error);
  }
};

exports.deleteFee = async (req, res, next) => {
  try {
    const deleted = await Fee.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Fee record not found" });
    }
    res.json({ success: true, message: "Fee deleted" });
  } catch (error) {
    next(error);
  }
};

exports.listFees = async (_req, res, next) => {
  try {
    const fees = await Fee.find().sort({ className: 1 });
    res.json({ success: true, count: fees.length, fees });
  } catch (error) {
    next(error);
  }
};

// About (single document)
exports.getAboutAdmin = async (_req, res, next) => {
  try {
    let about = await About.findOne();
    if (!about) {
      about = await About.create({
        description:
          "J.C. Memorial School is committed to delivering quality education and holistic development.",
        vision: "To nurture responsible citizens and lifelong learners.",
        mission: "Empowering students with knowledge, values, and confidence.",
      });
    }
    res.json({ success: true, about });
  } catch (error) {
    next(error);
  }
};

exports.updateAbout = async (req, res, next) => {
  try {
    const {
      description,
      vision = "",
      mission = "",
      schoolName,
      heroImage,
    } = req.body;
    let about = await About.findOne();
    if (!about) {
      about = await About.create({
        description,
        vision,
        mission,
        schoolName,
        heroImage,
      });
    } else {
      about.description = description;
      about.vision = vision;
      about.mission = mission;
      if (schoolName) about.schoolName = schoolName;
      if (heroImage) about.heroImage = heroImage;
      await about.save();
    }

    res.json({ success: true, about });
  } catch (error) {
    next(error);
  }
};

// Notice visibility toggle
const Notice = require("../models/Notice");
exports.setNoticePublic = async (req, res, next) => {
  try {
    const { isPublic } = req.body;
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      { isPublic: Boolean(isPublic) },
      { new: true, runValidators: true },
    );

    if (!notice) {
      return res
        .status(404)
        .json({ success: false, message: "Notice not found" });
    }

    res.json({ success: true, notice });
  } catch (error) {
    next(error);
  }
};
