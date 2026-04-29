const Notice = require("../models/Notice");
const { sendToRoles } = require("../services/notificationService");

const buildNoticeMetadata = (input = {}) => {
  const isUrgent = input.type === "urgent";

  return {
    priority: isUrgent ? "high" : "normal",
    notification: isUrgent
      ? {
          prepared: true,
          channel: "in-app",
          status: "pending",
          preparedAt: new Date(),
        }
      : {
          prepared: false,
          channel: null,
          status: null,
          preparedAt: null,
        },
  };
};

const rolesFromAudience = (audience) => {
  if (audience === "student") return ["student"];
  if (audience === "teacher") return ["teacher"];
  return ["student", "teacher"];
};

const dispatchUrgentNoticeNotification = async (notice) => {
  try {
    const roles = rolesFromAudience(notice.targetAudience);
    const notifyResult = await sendToRoles({
      roles,
      title: notice.title,
      body: notice.description,
      data: {
        noticeId: notice._id.toString(),
        targetAudience: notice.targetAudience,
      },
    });

    notice.notification = {
      ...notice.notification,
      status: notifyResult.success ? "sent" : "failed",
    };
    await notice.save();
  } catch (error) {
    // Notification must never block notice creation.
    console.warn("Urgent notice notification failed:", error.message);
    try {
      notice.notification = {
        ...notice.notification,
        status: "failed",
      };
      await notice.save();
    } catch (_saveError) {
      // Ignore secondary failure to preserve existing notice creation behavior.
    }
  }
};

const getNotices = async (req, res, next) => {
  try {
    const { targetAudience, activeOnly = "true" } = req.query;
    const now = new Date();
    const filter = {};

    if (
      targetAudience &&
      ["student", "teacher", "all"].includes(targetAudience)
    ) {
      filter.targetAudience =
        targetAudience === "all" ? "all" : { $in: ["all", targetAudience] };
    } else if (req.user?.role === "student" || req.user?.role === "teacher") {
      filter.targetAudience = { $in: ["all", req.user.role] };
    }

    if (activeOnly === "true") {
      filter.$or = [{ expiresAt: null }, { expiresAt: { $gte: now } }];
    }

    const notices = await Notice.find(filter).sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notices.length,
      notices,
    });
  } catch (error) {
    next(error);
  }
};

const createNotice = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can publish notices",
      });
    }

    const noticePayload = {
      ...req.body,
      ...buildNoticeMetadata(req.body),
    };
    const notice = await Notice.create(noticePayload);

    if (notice.type === "urgent") {
      await dispatchUrgentNoticeNotification(notice);
    }

    res.status(201).json({
      success: true,
      message: "Notice created successfully",
      notice,
    });
  } catch (error) {
    next(error);
  }
};

const updateNotice = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update notices",
      });
    }

    const updatePayload = { ...req.body };
    const hasTypeUpdate = Object.prototype.hasOwnProperty.call(req.body, "type");
    if (hasTypeUpdate) {
      Object.assign(updatePayload, buildNoticeMetadata(req.body));
    }
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    const shouldDispatchUrgentNotification =
      notice.type === "urgent" &&
      (hasTypeUpdate ||
        Object.prototype.hasOwnProperty.call(req.body, "targetAudience") ||
        Object.prototype.hasOwnProperty.call(req.body, "title") ||
        Object.prototype.hasOwnProperty.call(req.body, "description"));

    if (shouldDispatchUrgentNotification) {
      await dispatchUrgentNoticeNotification(notice);
    }

    res.status(200).json({
      success: true,
      message: "Notice updated successfully",
      notice,
    });
  } catch (error) {
    next(error);
  }
};

const deleteNotice = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete notices",
      });
    }

    const notice = await Notice.findByIdAndDelete(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotices,
  createNotice,
  updateNotice,
  deleteNotice,
};
