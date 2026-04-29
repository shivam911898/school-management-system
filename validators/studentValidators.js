const { body } = require("express-validator");

const studentValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Student name is required")
    .isLength({ min: 2, max: 80 })
    .withMessage("Student name must be between 2 and 80 characters"),
  body("className")
    .trim()
    .notEmpty()
    .withMessage("Class is required")
    .isLength({ max: 20 })
    .withMessage("Class must be 20 characters or fewer"),
  body("section")
    .trim()
    .notEmpty()
    .withMessage("Section is required")
    .isLength({ min: 1, max: 5 })
    .withMessage("Section must be between 1 and 5 characters"),
  body("rollNumber")
    .isInt({ min: 1 })
    .withMessage("Roll number must be a positive number")
    .toInt(),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required for password recovery")
    .bail()
    .isMobilePhone(["en-IN", "en-US", "en-GB"])
    .withMessage("Please provide a valid phone number (e.g., +91XXXXXXXXXX)"),
];

module.exports = {
  studentValidator,
};
