const express = require("express");
const {
  register,
  login,
  logout,
  getMe,
  getSetupStatus,
  getHomeRoute,
  forgotPassword,
  resetPassword,
  forgotPasswordSMS,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  registerValidator,
  loginValidator,
} = require("../validators/authValidators");

const router = express.Router();

router.get("/setup-status", getSetupStatus);

// Password reset endpoints
router.post("/forgot-password", async (req, res, next) => {
  try {
    await forgotPassword(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    await resetPassword(req, res, next);
  } catch (error) {
    next(error);
  }
});

// SMS-based password reset
router.post("/forgot-password-sms", async (req, res, next) => {
  try {
    await forgotPasswordSMS(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Conditional registration route - allow unauthenticated only when no users exist
router.post("/register", async (req, res, next) => {
  try {
    const User = require("../models/User");
    const existingUsersCount = await User.countDocuments();

    if (existingUsersCount === 0) {
      // Allow unauthenticated registration for first admin
      // Apply validators in sequence
      for (const validator of registerValidator) {
        await new Promise((resolve, reject) => {
          validator(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      // After all validators pass, check for validation errors
      await new Promise((resolve, reject) => {
        validateRequest(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      // Finally call register handler
      return register(req, res, next);
    } else {
      // Require admin authentication for subsequent registrations
      // First check protection
      await new Promise((resolve, reject) => {
        protect(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Then apply validators
      for (const validator of registerValidator) {
        await new Promise((resolve, reject) => {
          validator(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Check for validation errors
      await new Promise((resolve, reject) => {
        validateRequest(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Finally call register handler
      return register(req, res, next);
    }
  } catch (error) {
    next(error);
  }
});

router.post("/login", loginValidator, validateRequest, login);
router.post("/logout", protect, logout);
router.get("/logout", async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.redirect("/login");
});
router.get("/me", protect, getMe);
router.get("/home", protect, getHomeRoute);
router.post("/change-password", protect, changePassword);

module.exports = router;
