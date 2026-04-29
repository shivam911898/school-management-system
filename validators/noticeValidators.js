const { body } = require("express-validator");

const noticeValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 120 })
    .withMessage("Title must be 120 characters or fewer"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 2000 })
    .withMessage("Description must be 2000 characters or fewer"),
  body("date").isISO8601().withMessage("A valid date is required"),
  body("type")
    .optional()
    .isIn(["normal", "urgent"])
    .withMessage("Type must be normal or urgent"),
  body("targetAudience")
    .optional()
    .isIn(["student", "teacher", "all"])
    .withMessage("Target audience must be student, teacher, or all"),
  body("expiresAt")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("expiresAt must be a valid date"),
  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic must be true or false"),
];

module.exports = {
  noticeValidator,
};
