// Public Notices API
const express = require("express");
const Notice = require("../models/Notice");
const Admission = require("../models/Admission");
const Fee = require("../models/Fee");
const About = require("../models/About");
const router = express.Router();

// GET /public/notices - fetch only public notices, sorted by latest
router.get("/notices", async (req, res) => {
  try {
    const notices = await Notice.find({ isPublic: true })
      .sort({ date: -1, createdAt: -1 })
      .select("title description date type");
    res.json({ success: true, notices });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Placeholder for admissions, fees, about (synthetic data for now)
router.get("/admissions", async (_req, res) => {
  try {
    const admissions = await Admission.find().sort({
      startDate: -1,
      createdAt: -1,
    });
    if (admissions.length > 0) {
      return res.json({ success: true, admissions });
    }

    return res.json({
      success: true,
      admissions: [
        {
          title: "Admissions Open 2026",
          description: "Admissions are open for classes Nursery to 10.",
          startDate: "2026-04-20",
          requirements: [
            "Birth Certificate",
            "Previous Marksheet",
            "Transfer Certificate",
            "Passport-size Photos",
          ],
        },
      ],
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch admissions" });
  }
});

router.get("/fees", async (_req, res) => {
  try {
    const fees = await Fee.find().sort({ className: 1 });
    if (fees.length > 0) {
      return res.json({ success: true, fees });
    }

    return res.json({
      success: true,
      fees: [
        { className: "Nursery", amount: 1000, details: "Monthly tuition" },
        { className: "1", amount: 1200, details: "Monthly tuition" },
        { className: "6", amount: 1600, details: "Monthly tuition" },
      ],
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch fees" });
  }
});

router.get("/about", async (_req, res) => {
  try {
    const about = await About.findOne();
    if (about) {
      return res.json({ success: true, about });
    }

    return res.json({
      success: true,
      about: {
        schoolName: "J.C. Memorial School, Nagra, Ballia",
        description:
          "J.C. Memorial School is committed to providing quality education and holistic development for every child.",
        vision: "To nurture responsible citizens and lifelong learners.",
        mission:
          "Empowering students with knowledge, skills, and values for a better tomorrow.",
        heroImage: "/images/school-banner.png",
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch about data" });
  }
});

module.exports = router;
