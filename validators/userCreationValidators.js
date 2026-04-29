const { body } = require("express-validator");

const createManagedUserValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .withMessage("Password must contain at least one letter and one number"),
  body("role")
    .isIn(["teacher", "student"])
    .withMessage("Role must be teacher or student"),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required for password recovery")
    .bail()
    .isMobilePhone(["en-IN", "en-US", "en-GB"])
    .withMessage("Please provide a valid phone number (e.g., +91XXXXXXXXXX)"),
  body("subjects")
    .optional()
    .isArray()
    .withMessage("Subjects must be an array"),
  body("class")
    .if(body("role").equals("student"))
    .trim()
    .notEmpty()
    .withMessage("Class is required for students"),
  body("dateOfBirth")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Date of birth is required for students")
    .bail()
    .isISO8601()
    .withMessage("Please provide a valid date of birth"),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 250 })
    .withMessage("Address must be 250 characters or fewer"),
];

module.exports = {
  createManagedUserValidator,
};
