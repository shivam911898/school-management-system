const Attendance = require("../models/Attendance");
const User = require("../models/User");

// Mark attendance for students (teacher/admin only)
const markAttendance = async (req, res, next) => {
  try {
    const { class: className, subject, date, attendanceRecords } = req.body;

    // Validate attendance records
    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance records are required",
      });
    }

    const attendanceDate = new Date(date);
    const results = [];

    for (const record of attendanceRecords) {
      const { studentId, status, remarks } = record;

      // Validate student exists - try multiple lookup methods
      let student = null;

      // First try by studentId
      student = await User.findOne({ studentId: studentId });

      // If not found, try by _id (MongoDB ObjectId)
      if (!student) {
        student = await User.findById(studentId);
      }

      // If still not found, try by rollNumber
      if (!student) {
        student = await User.findOne({ rollNumber: studentId });
      }

      if (!student || student.role !== "student") {
        results.push({
          studentId,
          success: false,
          error: "Invalid student",
        });
        continue;
      }

      try {
        // BUG FIX #5: Extract section robustly (e.g., "10A" -> "A", "Class10A" -> "A")
        // Previously used slice(-1) which could return a digit for class names like "10"
        const sectionMatch = className.match(/([A-Z])$/i);
        const section = sectionMatch ? sectionMatch[1].toUpperCase() : null;

        // Validate section
        if (!section) {
          results.push({
            studentId,
            success: false,
            error: `Invalid section format: class name '${className}' must end with a letter (e.g., '10A')`,
          });
          continue;
        }

        // Check if attendance already exists
        const existingAttendance = await Attendance.findOne({
          student: student._id,
          class: className,
          section: section,
          subject,
          date: attendanceDate,
        });

        if (existingAttendance) {
          // Update existing attendance
          existingAttendance.status = status;
          existingAttendance.remarks = remarks;
          existingAttendance.markedBy = req.user._id;
          await existingAttendance.save();

          results.push({
            studentId,
            success: true,
            message: "Attendance updated successfully",
          });
        } else {
          // Create new attendance record
          const newAttendance = new Attendance({
            student: student._id,
            class: className,
            section: section,
            subject,
            date: attendanceDate,
            status,
            remarks,
            markedBy: req.user._id,
          });

          await newAttendance.save();

          results.push({
            studentId,
            success: true,
            message: "Attendance marked successfully",
          });
        }
      } catch (error) {
        results.push({
          studentId,
          success: false,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Attendance processed successfully",
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// Get attendance by class and date (teacher/admin only)
const getClassAttendance = async (req, res, next) => {
  try {
    const { class: className, date } = req.query;

    if (!className || !date) {
      return res.status(400).json({
        success: false,
        message: "Class and date are required",
      });
    }

    const attendanceDate = new Date(date);
    const attendance = await Attendance.find({
      class: className,
      date: attendanceDate,
    })
      .populate("student", "name studentId email")
      .populate("markedBy", "name email")
      .sort({ date: 1 });

    // Sort by student name after populate (MongoDB can't sort on populated fields)
    attendance.sort((a, b) => {
      if (!a.student || !b.student) return 0;
      return a.student.name.localeCompare(b.student.name);
    });

    // Get all students in the class for comparison
    const allStudents = await User.find({
      role: "student",
      class: className,
      isActive: true,
    }).select("name studentId email");

    // Mark students who don't have attendance records
    const studentsWithAttendance = attendance.map((a) =>
      a.student._id.toString(),
    );
    const studentsWithoutAttendance = allStudents.filter(
      (student) => !studentsWithAttendance.includes(student._id.toString()),
    );

    res.status(200).json({
      success: true,
      data: {
        attendance,
        studentsWithoutAttendance,
        totalStudents: allStudents.length,
        markedCount: attendance.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get student attendance history (RBAC)
const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    // RBAC check
    if (req.user.role === "student" && req.user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const student = await User.findOne({ studentId, role: "student" });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const filter = { student: student._id };

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const attendance = await Attendance.find(filter)
      .populate("markedBy", "name email")
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(filter);

    // Calculate attendance statistics
    const stats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const subjectWise = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$subject",
          totalClasses: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ["$status", "present"] }, 1, 0],
            },
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ["$status", "absent"] }, 1, 0],
            },
          },
          late: {
            $sum: {
              $cond: [{ $eq: ["$status", "late"] }, 1, 0],
            },
          },
          excused: {
            $sum: {
              $cond: [{ $eq: ["$status", "excused"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          subject: "$_id",
          totalClasses: 1,
          present: 1,
          absent: 1,
          late: 1,
          excused: 1,
          attendancePercentage: {
            $round: [
              {
                $cond: [
                  { $gt: ["$totalClasses", 0] },
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $add: ["$present", "$late"] },
                          "$totalClasses",
                        ],
                      },
                      100,
                    ],
                  },
                  0,
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { subject: 1 } },
    ]);

    const attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    stats.forEach((stat) => {
      attendanceStats[stat._id] = stat.count;
    });

    const totalClasses = Object.values(attendanceStats).reduce(
      (a, b) => a + b,
      0,
    );
    const attendancePercentage =
      totalClasses > 0
        ? (
            ((attendanceStats.present + attendanceStats.late) / totalClasses) *
            100
          ).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        attendance,
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          class: student.class,
        },
        statistics: {
          ...attendanceStats,
          totalClasses,
          attendancePercentage: parseFloat(attendancePercentage),
        },
        subjectWise,
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

// Get attendance summary for a class (teacher/admin only)
const getClassAttendanceSummary = async (req, res, next) => {
  try {
    const { class: className, startDate, endDate } = req.query;

    if (!className) {
      return res.status(400).json({
        success: false,
        message: "Class is required",
      });
    }

    const filter = { class: className };

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const summary = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$student",
          totalClasses: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
          },
          excused: {
            $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $project: {
          student: {
            _id: "$student._id",
            name: "$student.name",
            studentId: "$student.studentId",
            email: "$student.email",
          },
          totalClasses: 1,
          present: 1,
          absent: 1,
          late: 1,
          excused: 1,
          // BUG FIX #4: Guard against division by zero when totalClasses is 0
          attendancePercentage: {
            $cond: [
              { $gt: ["$totalClasses", 0] },
              {
                $multiply: [
                  { $divide: [{ $add: ["$present", "$late"] }, "$totalClasses"] },
                  100,
                ]
              },
              0
            ]
          },
        },
      },
      { $sort: { "student.name": 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

// Delete attendance record (admin only)
const deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findByIdAndDelete(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get teacher's attendance records (teacher only)
const getTeacherAttendance = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const filter = { markedBy: req.user._id };

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const attendance = await Attendance.find(filter)
      .populate("student", "name studentId class")
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Export class attendance as CSV (admin/teacher only)
const exportClassAttendanceCSV = async (req, res, next) => {
  try {
    const { class: className, startDate, endDate, subject } = req.query;

    if (!className) {
      return res.status(400).json({ success: false, message: "Class is required" });
    }

    const filter = { class: className };
    if (subject) filter.subject = subject;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const records = await Attendance.find(filter)
      .populate("student", "name studentId")
      .populate("markedBy", "name")
      .sort({ date: 1, "student.name": 1 })
      .lean();

    // Build CSV
    const header = "Date,Student Name,Student ID,Subject,Status,Remarks,Marked By\n";
    const rows = records.map((r) => {
      const date = new Date(r.date).toISOString().split("T")[0];
      const studentName = r.student?.name || "Unknown";
      const studentId = r.student?.studentId || "";
      const markedBy = r.markedBy?.name || "";
      const remarks = (r.remarks || "").replace(/,/g, ";");
      return `${date},${studentName},${studentId},${r.subject},${r.status},${remarks},${markedBy}`;
    });

    const csv = header + rows.join("\n");
    const filename = `attendance_${className}_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  getClassAttendance,
  getStudentAttendance,
  getClassAttendanceSummary,
  deleteAttendance,
  getTeacherAttendance,
  exportClassAttendanceCSV,
};
