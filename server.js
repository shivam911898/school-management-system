require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const pino = require("pino");
const pinoHttp = require("pino-http");
const hpp = require("hpp");

const { connectDB, isDatabaseReady } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userManagementRoutes = require("./routes/userManagementRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const enhancedAttendanceRoutes = require("./routes/enhancedAttendanceRoutes");
const classRoutes = require("./routes/classRoutes");
const studentRoutes = require("./routes/studentRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const feeRoutes = require("./routes/feeRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const publicRoutes = require("./routes/publicRoutes");
const adminPublicContentRoutes = require("./routes/adminPublicContentRoutes");
const PORT = process.env.PORT || 5000;
const requireDb = process.env.REQUIRE_DB === "true";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
});

const httpLogger = pinoHttp({ logger });

app.use(httpLogger);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://www.gstatic.com",
        ],
        "connect-src": [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://fcmregistrations.googleapis.com",
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      },
    },
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.get("/api/health", (req, res) => {
  const dbConnected = isDatabaseReady();

  res.status(200).json({
    success: true,
    message: "Server is healthy",
    database: {
      connected: dbConnected,
      status: dbConnected ? "up" : "down",
    },
  });
});

app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    return next();
  }

  if (!isDatabaseReady()) {
    return res.status(503).json({
      success: false,
      message: "Database is unavailable. Try again after MongoDB is running.",
    });
  }

  return next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userManagementRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/attendance-enhanced", enhancedAttendanceRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/fees", feeRoutes);

app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  }),
);
app.use("/public", publicRoutes);
app.use("/admin", adminPublicContentRoutes);
app.use("/api/admin", adminPublicContentRoutes);

const pageAccessRules = {
  "/": null,
  "/admissions": null,
  "/fees": null,
  "/about": null,
  "/announcements": null,
  "/login": null,
  "/login/admin": null,
  "/login/teacher": null,
  "/login/student": null,
  "/forgot-password": null,
  "/forgot-password-sms": null,
  "/reset-password": null,
  "/admin/dashboard": ["admin"],
  "/admin/public-content": ["admin"],
  "/teacher/dashboard": ["teacher"],
  "/student/dashboard": ["student"],
  "/dashboard": ["admin", "teacher", "student"],
  "/students": ["admin", "teacher"],
  "/notices": ["admin"],
  "/attendance": ["admin", "teacher"],
  "/classes": ["admin"],
  "/user-management": ["admin"],
  "/attendance-analytics": ["admin"],
  "/attendance-management": ["admin", "teacher"],
  "/admin-dashboard": ["admin"],
};

const getHomeRouteByRole = (role) =>
  role === "admin"
    ? "/admin/dashboard"
    : role === "teacher"
      ? "/teacher/dashboard"
      : "/student/dashboard";

const getUserFromToken = async (req) => {
  const authHeader = req.headers.authorization;
  let token = req.cookies?.token;

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) return null;
    return user;
  } catch (_error) {
    return null;
  }
};

app.get(
  [
    "/",
    "/admissions",
    "/fees",
    "/about",
    "/announcements",
    "/login",
    "/login/admin",
    "/login/teacher",
    "/login/student",
    "/forgot-password",
    "/forgot-password-sms",
    "/reset-password",
    "/admin/dashboard",
    "/admin/public-content",
    "/teacher/dashboard",
    "/student/dashboard",
    "/dashboard",
    "/students",
    "/notices",
    "/attendance",
    "/classes",
    "/user-management",
    "/attendance-analytics",
    "/attendance-management",
    "/admin-dashboard",
  ],
  async (req, res) => {
    const allowedRoles = pageAccessRules[req.path] || null;

    if (allowedRoles) {
      const user = await getUserFromToken(req);

      if (!user) {
        return res.redirect("/login");
      }

      if (!allowedRoles.includes(user.role)) {
        return res.redirect(getHomeRouteByRole(user.role));
      }
    }

    const routeMap = {
      "/": "public-site/index.html",
      "/admissions": "public-site/admissions.html",
      "/fees": "public-site/fees.html",
      "/about": "public-site/about.html",
      "/announcements": "public-site/announcements.html",
      "/login": "login.html",
      "/login/admin": "login-role.html",
      "/login/teacher": "login-role.html",
      "/login/student": "login-role.html",
      "/forgot-password": "forgot-password.html",
      "/forgot-password-sms": "forgot-password-sms.html",
      "/reset-password": "reset-password.html",
      "/admin/dashboard": "admin-dashboard.html",
      "/admin/public-content": "admin-dashboard/public-content.html",
      "/teacher/dashboard": "dashboard.html",
      "/student/dashboard": "dashboard.html",
      "/dashboard": "dashboard.html",
      "/students": "students.html",
      "/notices": "notices.html",
      "/attendance": "attendance.html",
      "/classes": "classes.html",
      "/user-management": "user-management.html",
      "/attendance-analytics": "attendance-analytics.html",
      "/attendance-management": "attendance.html",
      "/admin-dashboard": "admin-dashboard.html",
    };

    res.sendFile(path.join(__dirname, "public", routeMap[req.path]));
  },
);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  const dbConnected = await connectDB();

  if (!dbConnected && requireDb) {
    console.error(
      "REQUIRE_DB=true and database connection failed. Exiting process.",
    );
    process.exit(1);
  }

  if (!dbConnected) {
    console.warn("Starting in degraded mode because MongoDB is unavailable.");
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.error(
        `Port ${PORT} is already in use. Stop the existing process or change PORT in .env.`,
      );
      process.exit(1);
    }

    logger.error("Server failed to start:", error.message);
    process.exit(1);
  });

  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully.`);
    server.close(() => {
      logger.info("HTTP server closed.");
      mongoose.connection.close(false, () => {
        logger.info("MongoDB connection closed.");
        process.exit(0);
      });
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

startServer();
