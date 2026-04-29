const User = require("../models/User");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Notice = require("../models/Notice");

const buildRoleNoticeFilter = (role) => {
  const now = new Date();
  const filter = {
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
  };

  if (role === "teacher" || role === "student") {
    filter.targetAudience = { $in: ["all", role] };
  }

  return filter;
};

const getRoleDashboardOverview = async (req, res, next) => {
  try {
    const { role, _id: userId } = req.user;
    const noticeFilter = buildRoleNoticeFilter(role);

    const [latestNotices, totalNotices] = await Promise.all([
      Notice.find(noticeFilter)
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      Notice.countDocuments(noticeFilter),
    ]);

    if (role === "admin") {
      const [totalStudents, totalTeachers, totalClasses, recentStudents] =
        await Promise.all([
          Student.countDocuments(),
          User.countDocuments({ role: "teacher", isActive: true }),
          Class.countDocuments({ isActive: true }),
          Student.find().sort({ createdAt: -1 }).limit(5).lean(),
        ]);

      return res.status(200).json({
        success: true,
        data: {
          role,
          summary: {
            totalStudents,
            totalTeachers,
            totalClasses,
            totalNotices,
          },
          recentStudents,
          notices: latestNotices,
        },
      });
    }

    if (role === "teacher") {
      const classes = await Class.find({ classTeacher: userId, isActive: true })
        .select("name")
        .lean();
      const classNames = classes.map((item) => item.name);

      const [studentsInMyClasses, recentStudents, totalTeachers] =
        await Promise.all([
          classNames.length
            ? Student.countDocuments({ className: { $in: classNames } })
            : 0,
          classNames.length
            ? Student.find({ className: { $in: classNames } })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
            : [],
          User.countDocuments({ role: "teacher", isActive: true }),
        ]);

      return res.status(200).json({
        success: true,
        data: {
          role,
          summary: {
            totalStudents: studentsInMyClasses,
            totalTeachers,
            myClasses: classNames.length,
            totalNotices,
          },
          recentStudents,
          notices: latestNotices,
        },
      });
    }

    // Student dashboard
    const [attendanceStats, subjectAttendance] = await Promise.all([
      Attendance.aggregate([
        { $match: { student: userId } },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0],
              },
            },
          },
        },
      ]),
      Attendance.aggregate([
        { $match: { student: userId } },
        {
          $group: {
            _id: "$subject",
            totalClasses: { $sum: 1 },
            presentCount: {
              $sum: {
                $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0],
              },
            },
            absentCount: {
              $sum: {
                $cond: [{ $eq: ["$status", "absent"] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            subject: "$_id",
            totalClasses: 1,
            presentCount: 1,
            absentCount: 1,
            attendancePercent: {
              $cond: [
                { $gt: ["$totalClasses", 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$presentCount", "$totalClasses"] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { subject: 1 } },
      ]),
    ]);

    const summaryRow = attendanceStats[0] || {
      totalClasses: 0,
      presentCount: 0,
    };
    const myAttendancePercent =
      summaryRow.totalClasses > 0
        ? Number(
            ((summaryRow.presentCount / summaryRow.totalClasses) * 100).toFixed(
              2,
            ),
          )
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        role,
        summary: {
          myAttendancePercent,
          totalNotices,
          totalClasses: summaryRow.totalClasses,
        },
        studentProfile: {
          name: req.user.name,
          email: req.user.email,
          class: req.user.class,
          studentId: req.user.studentId,
        },
        subjectAttendance,
        notices: latestNotices,
        recentStudents: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Simplified dashboard controller with basic queries
const getDashboardMetrics = async (req, res, next) => {
  try {
    const { class: className, section, dateRange = "30" } = req.query;

    // Build match conditions
    const userMatch = { role: "student", isActive: true };
    if (className) {
      userMatch.class = className;
    }

    // Date range filter
    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Execute basic queries
    const [
      totalStudents,
      totalClasses,
      allStudents,
      allClasses,
      attendanceRecords,
    ] = await Promise.all([
      User.countDocuments(userMatch),
      Class.countDocuments({ isActive: true }),
      User.find(userMatch).select("class").lean(),
      Class.find({ isActive: true }).select("name").lean(),
      Attendance.find({
        date: { $gte: startDate },
        ...(className && { class: className }),
        ...(section && { section }),
      }).lean(),
    ]);

    // Calculate class distribution
    const classDistribution = allClasses
      .reduce((acc, cls) => {
        const studentCount = allStudents.filter(
          (s) => s.class === cls.name,
        ).length;
        acc.push({
          class: cls.name,
          totalStudents: studentCount,
        });
        return acc;
      }, [])
      .sort((a, b) => a.class.localeCompare(b.class));

    // Calculate section distribution
    const sectionDistribution = ["A", "B"].map((section) => ({
      section,
      totalStudents: allStudents.filter(
        (s) => s.class && s.class.endsWith(section),
      ).length,
    }));

    // Calculate attendance statistics
    const totalAttendanceRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(
      (r) => r.status === "present",
    ).length;
    const absentCount = attendanceRecords.filter(
      (r) => r.status === "absent",
    ).length;
    const lateCount = attendanceRecords.filter(
      (r) => r.status === "late",
    ).length;
    const excusedCount = attendanceRecords.filter(
      (r) => r.status === "excused",
    ).length;
    const attendancePercentage =
      totalAttendanceRecords > 0
        ? ((presentCount / totalAttendanceRecords) * 100).toFixed(2)
        : 0;

    // Calculate class-wise attendance
    const classAttendanceBreakdown = allClasses.map((cls) => {
      const classAttendance = attendanceRecords.filter(
        (r) => r.class === cls.name,
      );
      const classPresent = classAttendance.filter(
        (r) => r.status === "present",
      ).length;
      const classTotal = classAttendance.length;
      const classPercentage =
        classTotal > 0 ? ((classPresent / classTotal) * 100).toFixed(2) : 0;

      return {
        class: cls.name,
        section: cls.name.slice(-1),
        totalRecords: classTotal,
        presentCount: classPresent,
        absentCount: classAttendance.filter((r) => r.status === "absent")
          .length,
        lateCount: classAttendance.filter((r) => r.status === "late").length,
        excusedCount: classAttendance.filter((r) => r.status === "excused")
          .length,
        attendancePercentage: parseFloat(classPercentage),
      };
    });

    // Calculate low attendance students
    const studentAttendanceMap = new Map();
    attendanceRecords.forEach((record) => {
      if (!studentAttendanceMap.has(record.student.toString())) {
        studentAttendanceMap.set(record.student.toString(), {
          studentId: null,
          name: null,
          class: record.class,
          section: record.section,
          totalClasses: 0,
          presentCount: 0,
        });
      }

      const student = studentAttendanceMap.get(record.student.toString());
      student.totalClasses++;
      if (record.status === "present") {
        student.presentCount++;
      }
    });

    // Populate student details
    const students = await User.find({
      _id: { $in: Array.from(studentAttendanceMap.keys()) },
    })
      .select("studentId name")
      .lean();

    students.forEach((student) => {
      const attendance = studentAttendanceMap.get(student._id.toString());
      if (attendance) {
        attendance.studentId = student.studentId;
        attendance.name = student.name;
      }
    });

    const lowAttendanceStudents = Array.from(studentAttendanceMap.values())
      .map((student) => ({
        ...student,
        attendancePercentage:
          student.totalClasses > 0
            ? ((student.presentCount / student.totalClasses) * 100).toFixed(2)
            : 0,
      }))
      .filter((student) => student.attendancePercentage < 75)
      .sort(
        (a, b) =>
          parseFloat(a.attendancePercentage) -
          parseFloat(b.attendancePercentage),
      )
      .slice(0, 10);

    const dashboardData = {
      summary: {
        totalStudents,
        totalClasses,
        overallAttendance: parseFloat(attendancePercentage),
        totalAttendanceRecords,
        activeStudents: new Set(
          attendanceRecords.map((r) => r.student.toString()),
        ).size,
      },
      distributions: {
        byClass: classDistribution,
        bySection: sectionDistribution,
      },
      attendance: {
        stats: {
          totalRecords: totalAttendanceRecords,
          uniqueStudents: new Set(
            attendanceRecords.map((r) => r.student.toString()),
          ).size,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          attendancePercentage: parseFloat(attendancePercentage),
        },
        classBreakdown: classAttendanceBreakdown,
        trends: [],
        topPerformingClasses: classAttendanceBreakdown
          .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
          .slice(0, 5),
        lowAttendanceStudents,
      },
      filters: {
        class: className,
        section,
        dateRange,
      },
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    next(error);
  }
};

// Get detailed class information
const getClassDetails = async (req, res, next) => {
  try {
    const { className } = req.params;

    const classData = await Class.findOne({ name: className, isActive: true })
      .populate("classTeacher", "name email employeeId")
      .lean();

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const [students, recentAttendance] = await Promise.all([
      User.find({ class: className, role: "student", isActive: true })
        .select("studentId name email dateOfBirth isActive")
        .sort({ name: 1 })
        .lean(),

      Attendance.find({
        class: className,
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }).lean(),
    ]);

    // Process recent attendance
    const attendanceMap = new Map();
    recentAttendance.forEach((record) => {
      if (!attendanceMap.has(record.student.toString())) {
        attendanceMap.set(record.student.toString(), {
          studentId: null,
          name: null,
          totalClasses: 0,
          presentCount: 0,
          absentCount: 0,
          lastAttendance: record.date,
        });
      }

      const attendance = attendanceMap.get(record.student.toString());
      attendance.totalClasses++;
      if (record.status === "present") {
        attendance.presentCount++;
      } else if (record.status === "absent") {
        attendance.absentCount++;
      }
    });

    // Populate student details
    const studentIds = Array.from(attendanceMap.keys());
    const studentDetails = await User.find({ _id: { $in: studentIds } })
      .select("studentId name")
      .lean();

    studentDetails.forEach((student) => {
      const attendance = attendanceMap.get(student._id.toString());
      if (attendance) {
        attendance.studentId = student.studentId;
        attendance.name = student.name;
        attendance.attendancePercentage =
          attendance.totalClasses > 0
            ? (
                (attendance.presentCount / attendance.totalClasses) *
                100
              ).toFixed(2)
            : 0;
      }
    });

    const processedAttendance = Array.from(attendanceMap.values());

    res.status(200).json({
      success: true,
      data: {
        class: classData,
        students,
        recentAttendance: processedAttendance,
      },
    });
  } catch (error) {
    console.error("Class details error:", error);
    next(error);
  }
};

// Get system health metrics
const getSystemHealth = async (req, res, next) => {
  try {
    const [totalUsers, activeUsers, totalClasses, totalAttendance] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Class.countDocuments({ isActive: true }),
        Attendance.countDocuments(),
      ]);

    // Recent activity (last 24 hours)
    const recentActivity = await Attendance.find({
      date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).lean();

    const recentActivityData = {
      totalRecords: recentActivity.length,
      presentCount: recentActivity.filter((r) => r.status === "present").length,
      activeStudents: new Set(recentActivity.map((r) => r.student.toString()))
        .size,
    };

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        classes: {
          total: totalClasses,
        },
        attendance: {
          totalRecords: totalAttendance,
          todayActivity: recentActivityData,
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
        },
      },
    });
  } catch (error) {
    console.error("System health error:", error);
    next(error);
  }
};

module.exports = {
  getRoleDashboardOverview,
  getDashboardMetrics,
  getClassDetails,
  getSystemHealth,
};
