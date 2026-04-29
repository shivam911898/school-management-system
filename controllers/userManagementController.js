const User = require("../models/User");
const { safeCreateAuditLog } = require("../services/auditLogService");
const { generateUserIdentity } = require("../services/userIdentityService");

// Get all users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 10, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { teacherId: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID (with RBAC)
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // RBAC: Students can only view their own profile
    if (req.user.role === "student" && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Teachers can only view their own profile or student records.
    if (req.user.role === "teacher") {
      const isOwnProfile = req.user._id.toString() === id;
      if (!isOwnProfile && user.role !== "student") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Create new user (admin only)
const createUser = async (req, res, next) => {
  try {
    const userData = { ...req.body };

    // Security: only teacher/student can be created through this management API.
    if (!["teacher", "student"].includes(userData.role)) {
      return res.status(400).json({
        success: false,
        message: "Only teacher and student accounts can be created",
      });
    }

    // Security: identity/email must be backend-generated only.
    delete userData.email;
    delete userData.studentId;
    delete userData.teacherId;
    delete userData.employeeId;

    const { idField, identity, email } = await generateUserIdentity(userData.role);

    userData[idField] = identity;
    userData.email = email;

    // Keep backward compatibility with legacy teacher employeeId usage.
    if (userData.role === "teacher") {
      userData.employeeId = identity;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const user = await User.create(userData);
    const userResponse = await User.findById(user._id).select("-password");

    await safeCreateAuditLog({
      req,
      actor: req.user,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user._id,
      targetSummary: `${user.email} (${user.role})`,
      metadata: {
        createdRole: user.role,
        createdByRoute: "/api/users",
      },
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
      generated: {
        identityField: idField,
        identity,
        email,
      },
    });
  } catch (error) {
    if (error?.message?.includes("Failed to generate unique")) {
      return res.status(503).json({
        success: false,
        message:
          "Identity generation service is temporarily unavailable. Please retry.",
      });
    }

    next(error);
  }
};

// Update user (with RBAC)
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // RBAC checks: non-admin users may only update their own profile
    if (req.user.role !== "admin" && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Teachers and students can only update limited fields
    if (req.user.role === "student" || req.user.role === "teacher") {
      const allowedFields = ["phone", "address"];
      const updates = {};
      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      });
      updateData = updates;
    }

    // Identity + generated email are immutable.
    delete updateData.email;
    delete updateData.employeeId;
    delete updateData.teacherId;
    delete updateData.studentId;

    // Don't allow role changes except by admin
    if (req.user.role !== "admin") {
      delete updateData.role;
      delete updateData.class;
      delete updateData.subjects;
      delete updateData.isActive;
    }

    // Don't allow password update through this endpoint
    delete updateData.password;

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    await safeCreateAuditLog({
      req,
      actor: req.user,
      action: "USER_UPDATED",
      targetType: "User",
      targetId: id,
      targetSummary: `${updatedUser.email} (${updatedUser.role})`,
      metadata: { updatedFields: Object.keys(updateData) },
    });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Delete user (admin only)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user active status (admin only)
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deactivating themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Cannot change your own account status",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      data: { isActive: user.isActive },
    });
  } catch (error) {
    next(error);
  }
};

// Get students by class (for teachers)
const getStudentsByClass = async (req, res, next) => {
  try {
    const { className } = req.params;

    if (req.user.role === "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const students = await User.find({
      role: "student",
      class: className,
      isActive: true,
    })
      .select("-password")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    next(error);
  }
};

// Get teachers by subject
const getTeachersBySubject = async (req, res, next) => {
  try {
    const { subject } = req.params;

    const teachers = await User.find({
      role: "teacher",
      subjects: subject,
      isActive: true,
    })
      .select("-password")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: teachers,
    });
  } catch (error) {
    next(error);
  }
};

// Get own profile (any authenticated user)
const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getStudentsByClass,
  getTeachersBySubject,
  getMyProfile,
};
