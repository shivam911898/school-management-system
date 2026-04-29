const {
  sendToRoles,
  sendToTokens,
  registerUserToken,
  unregisterUserToken,
  normalizeRoles,
} = require("../services/notificationService");
const User = require("../models/User");

const registerDeviceToken = async (req, res, next) => {
  try {
    const token = String(req.body.token || "").trim();
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "token is required",
      });
    }

    await registerUserToken({ userId: req.user._id, token });

    return res.status(200).json({
      success: true,
      message: "Device token registered successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const unregisterDeviceToken = async (req, res, next) => {
  try {
    const token = String(req.body.token || "").trim();
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "token is required",
      });
    }

    await unregisterUserToken({ userId: req.user._id, token });

    return res.status(200).json({
      success: true,
      message: "Device token removed successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const sendRoleNotification = async (req, res, next) => {
  try {
    const { roles, title, body, data } = req.body;
    const normalizedRoles = normalizeRoles(roles);

    if (!normalizedRoles.length) {
      return res.status(400).json({
        success: false,
        message: "roles must include student and/or teacher",
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "title and body are required",
      });
    }

    const result = await sendToRoles({
      roles: normalizedRoles,
      title: String(title),
      body: String(body),
      data: data || {},
    });

    return res.status(200).json({
      success: true,
      message: "Notification request processed",
      result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerDeviceToken,
  unregisterDeviceToken,
  sendRoleNotification,
};
