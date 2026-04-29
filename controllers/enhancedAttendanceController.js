const Attendance = require("../models/Attendance");
const User = require("../models/User");

// Enhanced attendance controller with bulk marking and duplicate prevention
const bulkMarkAttendance = async (req, res, next) => {
  try {
    const {
      class: className,
      section,
      subject,
      date,
      attendanceRecords,
    } = req.body;
    const teacherId = req.user._id;

    // Validate required fields
    if (
      !className ||
      !section ||
      !subject ||
      !date ||
      !attendanceRecords ||
      !Array.isArray(attendanceRecords)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: class, section, subject, date, attendanceRecords (array)",
      });
    }

    // Validate attendance records
    const validStatuses = ["present", "absent", "late", "excused"];
    const processedRecords = [];
    const errors = [];

    for (let i = 0; i < attendanceRecords.length; i++) {
      const record = attendanceRecords[i];

      if (!record.studentId || !record.status) {
        errors.push(`Record ${i + 1}: Missing studentId or status`);
        continue;
      }

      if (!validStatuses.includes(record.status)) {
        errors.push(
          `Record ${i + 1}: Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        );
        continue;
      }

      // Get student information
      const student = await User.findOne({
        studentId: record.studentId,
        role: "student",
        isActive: true,
      });

      if (!student) {
        errors.push(
          `Record ${i + 1}: Student with ID ${record.studentId} not found`,
        );
        continue;
      }

      processedRecords.push({
        student: student._id,
        class: className,
        section,
        subject,
        date: new Date(date),
        status: record.status,
        markedBy: teacherId,
        remarks: record.remarks || "",
        checkInTime: record.checkInTime ? new Date(record.checkInTime) : null,
        checkOutTime: record.checkOutTime
          ? new Date(record.checkOutTime)
          : null,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors,
      });
    }

    // Bulk insert with duplicate prevention
    const results = [];
    const duplicates = [];
    const successful = [];

    for (const record of processedRecords) {
      try {
        // Check for existing attendance
        const existingAttendance = await Attendance.findOne({
          student: record.student,
          class: record.class,
          section: record.section,
          subject: record.subject,
          date: {
            $gte: new Date(record.date.setHours(0, 0, 0, 0)),
            $lt: new Date(record.date.setHours(23, 59, 59, 999)),
          },
        });

        if (existingAttendance) {
          duplicates.push({
            studentId:
              attendanceRecords.find((r) => {
                const student = processedRecords.find(
                  (pr) => pr.student === record.student,
                );
                return student && student.studentId;
              })?.studentId || "Unknown",
            message: "Attendance already marked for this date/subject",
          });
          continue;
        }

        const newAttendance = await Attendance.create(record);
        successful.push({
          studentId:
            attendanceRecords.find((r) => {
              const student = processedRecords.find(
                (pr) => pr.student === record.student,
              );
              return student && student.studentId;
            })?.studentId || "Unknown",
          status: record.status,
          attendanceId: newAttendance._id,
        });
        results.push(newAttendance);
      } catch (error) {
        if (error.code === 11000) {
          // MongoDB duplicate key error
          duplicates.push({
            studentId:
              attendanceRecords.find((r) => {
                const student = processedRecords.find(
                  (pr) => pr.student === record.student,
                );
                return student && student.studentId;
              })?.studentId || "Unknown",
            message: "Duplicate attendance record",
          });
        } else {
          errors.push({
            studentId:
              attendanceRecords.find((r) => {
                const student = processedRecords.find(
                  (pr) => pr.student === record.student,
                );
                return student && student.studentId;
              })?.studentId || "Unknown",
            message: error.message,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Attendance marked successfully. ${successful.length} records processed.`,
      data: {
        totalProcessed: attendanceRecords.length,
        successful: successful.length,
        duplicates: duplicates.length,
        errors: errors.length,
        results: {
          successful,
          duplicates,
          errors,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Enhanced attendance filtering with multiple criteria
const getFilteredAttendance = async (req, res, next) => {
  try {
    const {
      class: className,
      section,
      subject,
      date,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (className) filter.class = className;
    if (section) filter.section = section;
    if (subject) filter.subject = subject;
    if (status) filter.status = status;

    // Date filtering
    if (date) {
      const targetDate = new Date(date);
      filter.date = {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lt: new Date(targetDate.setHours(23, 59, 59, 999)),
      };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with population
    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate("student", "studentId name email")
        .populate("markedBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    // Calculate pagination
    const pages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        attendance,
        pagination: {
          current: parseInt(page),
          pages,
          total,
          limit: parseInt(limit),
          hasNext: parseInt(page) < pages,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          class: className,
          section,
          subject,
          date,
          startDate,
          endDate,
          status,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get student attendance with enhanced details
const getStudentAttendanceEnhanced = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const {
      startDate,
      endDate,
      includeAnalytics = "true",
      page = 1,
      limit = 50,
    } = req.query;

    // RBAC: students can only view their own attendance.
    if (req.user.role === "student" && req.user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Verify student exists
    const student = await User.findOne({
      studentId,
      role: "student",
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Build filter
    const filter = { student: student._id };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get attendance records
    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate("markedBy", "name email")
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    let analytics = null;
    if (includeAnalytics === "true") {
      // Get analytics using aggregation
      const analyticsData = await Attendance.aggregate([
        { $match: { student: student._id } },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            presentCount: {
              $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
            },
            absentCount: {
              $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
            },
            lateCount: {
              $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
            },
            excusedCount: {
              $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] },
            },
            firstDate: { $min: "$date" },
            lastDate: { $max: "$date" },
          },
        },
        {
          $addFields: {
            attendancePercentage: {
              $multiply: [{ $divide: ["$presentCount", "$totalClasses"] }, 100],
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalClasses: 1,
            presentCount: 1,
            absentCount: 1,
            lateCount: 1,
            excusedCount: 1,
            attendancePercentage: { $round: ["$attendancePercentage", 2] },
            firstDate: 1,
            lastDate: 1,
          },
        },
      ]);

      analytics = analyticsData[0] || null;
    }

    // Calculate pagination
    const pages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        student: {
          _id: student._id,
          studentId: student.studentId,
          name: student.name,
          class: student.class,
          section: student.section,
        },
        attendance,
        analytics,
        pagination: {
          current: parseInt(page),
          pages,
          total,
          limit: parseInt(limit),
          hasNext: parseInt(page) < pages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update attendance record
const updateAttendance = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Check if user has permission to update this attendance
    if (
      attendance.markedBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update attendance you marked",
      });
    }

    // Update fields
    if (status) attendance.status = status;
    if (remarks !== undefined) attendance.remarks = remarks;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// Delete attendance record (admin only)
const deleteAttendanceRecord = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    await Attendance.findByIdAndDelete(attendanceId);

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bulkMarkAttendance,
  getFilteredAttendance,
  getStudentAttendanceEnhanced,
  updateAttendance,
  deleteAttendanceRecord,
};
