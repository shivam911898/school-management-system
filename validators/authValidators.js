const { body } = require("express-validator");

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .if((value, { req }) => !req.body.role || req.body.role === "admin")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("A valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .withMessage("Password must contain at least one letter and one number"),
  body("role")
    .optional()
    .isIn(["admin", "teacher", "student"])
    .withMessage("Role must be admin, teacher, or student"),
  body("class")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Class is required for students"),
  body("subjects")
    .optional()
    .isArray()
    .withMessage("Subjects must be an array"),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required for password recovery")
    .bail()
    .isMobilePhone(["en-IN", "en-US", "en-GB"])
    .withMessage("Please provide a valid phone number (e.g., +91XXXXXXXXXX)"),
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid date of birth"),
];

const loginValidator = [
  body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("A valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  body("role")
    .optional()
    .isIn(["admin", "teacher", "student"])
    .withMessage("Role must be admin, teacher, or student"),
];

module.exports = {
  registerValidator,
  loginValidator,
};
