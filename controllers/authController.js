const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { safeCreateAuditLog } = require("../services/auditLogService");
const { generateUserIdentity } = require("../services/userIdentityService");
const { sendEmail } = require("../services/mailerService");

const buildToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const sendAuthResponse = (res, user, statusCode, message) => {
  const token = buildToken(user._id);
  const isProduction = process.env.NODE_ENV === "production";
  const cookieExpiresInDays = Number(process.env.COOKIE_EXPIRES_IN_DAYS || 7);

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: cookieExpiresInDays * 24 * 60 * 60 * 1000,
  });

  res.status(statusCode).json({
    success: true,
    message,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

const register = async (req, res, next) => {
  try {
    const existingUsersCount = await User.countDocuments();
    const requester = req.user;

    const {
      name,
      email,
      password,
      role,
      class: studentClass,
      subjects,
      phone,
      address,
      dateOfBirth,
    } = req.body;

    // If no users exist, allow first admin registration
    if (existingUsersCount === 0) {
      const user = await User.create({
        name,
        email,
        phone,
        password,
        role: "admin",
      });

      await safeCreateAuditLog({
        req,
        actor: null,
        action: "FIRST_ADMIN_REGISTERED",
        targetType: "User",
        targetId: user._id,
        targetSummary: `${user.email} (${user.role})`,
        metadata: { createdRole: "admin" },
      });

      sendAuthResponse(res, user, 201, "First admin registered successfully");
      return;
    }

    if (!requester) {
      return res.status(403).json({
        success: false,
        message: "Registration is disabled. Please contact admin.",
      });
    }

    if (requester.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create new users",
      });
    }

    const allowedManagedRoles = ["teacher", "student"];
    if (!role || !allowedManagedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Only teacher or student accounts can be created by admin",
      });
    }

    const { idField, identity, email: generatedEmail } =
      await generateUserIdentity(role);

    const userData = { name, email: generatedEmail, password, role };
    userData[idField] = identity;

    if (role === "teacher") {
      userData.employeeId = identity;
      if (subjects && Array.isArray(subjects)) {
        userData.subjects = subjects;
      }
    }

    if (role === "student") {
      if (!studentClass) {
        return res.status(400).json({
          success: false,
          message: "Class is required for students",
        });
      }
      userData.class = studentClass;
      if (dateOfBirth) {
        userData.dateOfBirth = new Date(dateOfBirth);
      }
    }

    if (address) userData.address = address;
    if (phone) userData.phone = phone;

    const user = await User.create(userData);

    await safeCreateAuditLog({
      req,
      actor: requester,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user._id,
      targetSummary: `${user.email} (${user.role})`,
      metadata: {
        createdRole: user.role,
        createdByRoute: "/api/auth/register",
      },
    });

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, role: requestedRole } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // BUG FIX #3: Check isActive status before allowing login
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact the administrator.",
      });
    }

    if (requestedRole && requestedRole !== user.role) {
      return res.status(403).json({
        success: false,
        message: `Role mismatch: this account is '${user.role}'. Please use the correct login portal.`,
      });
    }

    sendAuthResponse(res, user, 200, "Login successful");
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

const getSetupStatus = async (req, res, next) => {
  try {
    const usersCount = await User.countDocuments();

    res.status(200).json({
      success: true,
      registrationOpen: usersCount === 0,
    });
  } catch (error) {
    next(error);
  }
};

const getHomeRoute = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const homeMap = {
      admin: "/admin/dashboard",
      teacher: "/teacher/dashboard",
      student: "/student/dashboard",
    };
    const home = homeMap[role] || "/login";

    res.status(200).json({
      success: true,
      role,
      home,
    });
  } catch (error) {
    next(error);
  }
};

const getAppBaseUrl = (req) => {
  if (process.env.APP_BASE_URL) {
    return String(process.env.APP_BASE_URL).trim().replace(/\/$/, "");
  }

  const forwardedProto = req.headers["x-forwarded-proto"]
    ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim()
    : null;
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  return `${protocol}://${host}`;
};

const canExposeDebugResetInfo = () => process.env.NODE_ENV !== "production";

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user)
      return res.status(200).json({
        success: true,
        message: "If account exists, a reset link has been sent",
      });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    user.passwordResetToken = token;
    user.passwordResetExpires = expires;
    await user.save();

    const baseUrl = getAppBaseUrl(req);
    const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    const subject = "Password reset request";
    const html = `<p>Hello ${user.name || ""},</p>
      <p>We received a request to reset your password. Click the link below to reset it. The link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, you can ignore this email.</p>`;

    const emailResult = await sendEmail({ to: user.email, subject, html });

    if (emailResult?.previewUrl) {
      console.log(`[PasswordReset] Ethereal preview URL: ${emailResult.previewUrl}`);
    }
    console.log(`[PasswordReset] Generated reset URL for ${user.email}: ${resetUrl}`);

    const responsePayload = {
      success: true,
      message: "If account exists, a reset link has been sent",
    };

    if (canExposeDebugResetInfo()) {
      responsePayload.debug = {
        resetUrl,
        emailPreviewUrl: emailResult?.previewUrl || null,
      };
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword)
      return res
        .status(400)
        .json({ success: false, message: "Missing parameters" });

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
      passwordResetToken: token,
    }).select("+password +passwordResetToken +passwordResetExpires");
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid token or email" });

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.status(400).json({ success: false, message: "Token expired" });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};

const forgotPasswordSMS = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });

    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user)
      return res.status(200).json({
        success: true,
        message: "If account exists with this phone, an SMS has been sent",
      });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    user.passwordResetToken = token;
    user.passwordResetExpires = expires;
    await user.save();

    const baseUrl = getAppBaseUrl(req);
    const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    const message = `Password Reset Request\n\nClick here to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this message.`;

    let smsDelivery = "sent";

    try {
      const { sendSMS } = require("../services/smsService");
      await sendSMS({ to: user.phone, message });
    } catch (smsError) {
      console.error("SMS send failed:", smsError.message);
      smsDelivery = "failed";
    }

    const responsePayload = {
      success: true,
      message: "If account exists with this phone, an SMS has been sent",
    };

    if (canExposeDebugResetInfo()) {
      responsePayload.debug = {
        resetUrl,
        smsDelivery,
      };
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "New password must be at least 8 characters" });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least one letter and one number",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

// BUG FIX #1: Single module.exports with ALL functions (previously had two exports blocks)
module.exports = {
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
};
