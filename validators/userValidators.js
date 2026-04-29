const { body } = require("express-validator");

const updateUserValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .optional()
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("A valid email is required"),
  body("phone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Phone number is required for password recovery")
    .bail()
    .isMobilePhone(["en-IN", "en-US", "en-GB"])
    .withMessage("Please provide a valid phone number (e.g., +91XXXXXXXXXX)"),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 250 })
    .withMessage("Address must be 250 characters or fewer"),
];

module.exports = {
  updateUserValidator,
};
