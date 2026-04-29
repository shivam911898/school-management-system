const jwt = require("jsonwebtoken");
const User = require("../models/User");

const extractTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  let token = req.cookies.token;

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  return token;
};

const resolveUserFromToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId).select("-password");

  if (!user) {
    throw new Error("User no longer exists");
  }

  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  return user;
};

const protect = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await resolveUserFromToken(token);

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${roles.join(" or ")} role required`,
      });
    }
    next();
  };
};

// Explicit aliases requested for strict RBAC API contracts.
const verifyToken = protect;
const authorizeRoles = (...roles) => authorize(...roles);

const requireAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await resolveUserFromToken(token);

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${role} role required`,
      });
    }
    next();
  };
};

const requireAdmin = authorize("admin");
const requireTeacher = authorize("admin", "teacher");
// BUG FIX #7: Allow admin to access student endpoints (for management purposes)
const requireStudent = authorize("admin", "student");

const canAccessStudentData = (req, res, next) => {
  const { studentId } = req.params;

  // Admin can access any student data
  if (req.user.role === "admin") {
    return next();
  }

  // Teacher can access students in their class
  if (req.user.role === "teacher") {
    // Check if student is in teacher's class (implement logic based on your class system)
    return next();
  }

  // Student can only access their own data
  if (req.user.role === "student" && req.user.studentId === studentId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied to this student data",
  });
};

const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.cookies.token;

    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (user && user.isActive) {
      req.user = user;
    }

    return next();
  } catch (_error) {
    return next();
  }
};

module.exports = {
  protect,
  verifyToken,
  authorize,
  authorizeRoles,
  requireAuth,
  requireRole,
  requireAdmin,
  requireTeacher,
  requireStudent,
  canAccessStudentData,
  optionalProtect,
};
