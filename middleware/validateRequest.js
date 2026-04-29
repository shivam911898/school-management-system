const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const seen = new Set();
  const uniqueErrors = errors.array().filter((error) => {
    const key = `${error.location}:${error.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return res.status(400).json({
    success: false,
    message: uniqueErrors[0].msg,
    errors: uniqueErrors,
  });
};

module.exports = validateRequest;
