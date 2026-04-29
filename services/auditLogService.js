const AuditLog = require("../models/AuditLog");

const buildIpAddress = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip;
};

const safeCreateAuditLog = async ({
  req,
  actor,
  action,
  targetType,
  targetId,
  targetSummary,
  metadata = {},
}) => {
  try {
    await AuditLog.create({
      actorUserId: actor?._id || null,
      actorRole: actor?.role || "system",
      action,
      targetType,
      targetId: targetId || null,
      targetSummary,
      metadata,
      ipAddress: req ? buildIpAddress(req) : undefined,
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
};

module.exports = {
  safeCreateAuditLog,
};
