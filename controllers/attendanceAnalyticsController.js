const Attendance = require('../models/Attendance');
const User = require('../models/User');

// Analytics aggregation pipelines
const getClassAttendanceAnalytics = async (req, res, next) => {
  try {
    const { class: className, section, startDate, endDate } = req.query;
    
    const matchStage = {};
    if (className) matchStage.class = className;
    if (section) matchStage.section = section;
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const analytics = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            class: '$class',
            section: '$section',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
          },
          totalStudents: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          excusedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          attendancePercentage: {
            $multiply: [
              { $divide: ['$presentCount', '$totalStudents'] },
              100
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            class: '$_id.class',
            section: '$_id.section'
          },
          totalDays: { $sum: 1 },
          averageAttendance: { $avg: '$attendancePercentage' },
          totalPresent: { $sum: '$presentCount' },
          totalAbsent: { $sum: '$absentCount' },
          totalLate: { $sum: '$lateCount' },
          totalExcused: { $sum: '$excusedCount' },
          dailyBreakdown: {
            $push: {
              date: '$_id.date',
              percentage: '$attendancePercentage',
              present: '$presentCount',
              absent: '$absentCount'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          class: '$_id.class',
          section: '$_id.section',
          totalDays: 1,
          averageAttendance: { $round: ['$averageAttendance', 2] },
          totalPresent: 1,
          totalAbsent: 1,
          totalLate: 1,
          totalExcused: 1,
          dailyBreakdown: 1
        }
      },
      {
        $sort: { class: 1, section: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

const getStudentAttendanceAnalytics = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    const student = await User.findOne({ studentId, role: 'student', isActive: true }).select('_id');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const matchStage = { student: student._id };
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const analytics = await Attendance.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $group: {
          _id: {
            studentId: '$studentInfo.studentId',
            name: '$studentInfo.name',
            class: '$class',
            section: '$section'
          },
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          excusedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          attendancePercentage: {
            $multiply: [
              { $divide: ['$presentCount', '$totalClasses'] },
              100
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          studentId: '$_id.studentId',
          name: '$_id.name',
          class: '$_id.class',
          section: '$_id.section',
          totalClasses: 1,
          presentCount: 1,
          absentCount: 1,
          lateCount: 1,
          excusedCount: 1,
          attendancePercentage: { $round: ['$attendancePercentage', 2] }
        }
      }
    ]);

    if (!analytics.length) {
      return res.status(404).json({
        success: false,
        message: 'No attendance records found for this student'
      });
    }

    const studentAnalytics = analytics[0];
    const isLowAttendance = studentAnalytics.attendancePercentage < 75;

    res.status(200).json({
      success: true,
      data: {
        ...studentAnalytics,
        isLowAttendance,
        status: isLowAttendance ? 'At Risk' : 'Good'
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMonthlyTrends = async (req, res, next) => {
  try {
    const { class: className, section, months = 6 } = req.query;
    
    const matchStage = {};
    if (className) matchStage.class = className;
    if (section) matchStage.section = section;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    matchStage.date = { $gte: startDate };

    const trends = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            class: '$class',
            section: '$section'
          },
          totalStudents: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          attendancePercentage: {
            $multiply: [
              { $divide: ['$presentCount', '$totalStudents'] },
              100
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          class: '$_id.class',
          section: '$_id.section',
          totalStudents: 1,
          presentCount: 1,
          absentCount: 1,
          attendancePercentage: { $round: ['$attendancePercentage', 2] }
        }
      },
      {
        $sort: { year: 1, month: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    next(error);
  }
};

const getTopPerformingClasses = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const topClasses = await Attendance.aggregate([
      {
        $group: {
          _id: {
            class: '$class',
            section: '$section'
          },
          totalStudents: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          attendancePercentage: {
            $multiply: [
              { $divide: ['$presentCount', '$totalStudents'] },
              100
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          class: '$_id.class',
          section: '$_id.section',
          totalStudents: 1,
          presentCount: 1,
          attendancePercentage: { $round: ['$attendancePercentage', 2] }
        }
      },
      {
        $sort: { attendancePercentage: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.status(200).json({
      success: true,
      data: topClasses
    });
  } catch (error) {
    next(error);
  }
};

const getLowAttendanceStudents = async (req, res, next) => {
  try {
    const { class: className, section, threshold = 75 } = req.query;
    
    const matchStage = {};
    if (className) matchStage.class = className;
    if (section) matchStage.section = section;
    
    const lowAttendanceStudents = await Attendance.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $group: {
          _id: '$student',
          studentId: { $first: '$studentInfo.studentId' },
          name: { $first: '$studentInfo.name' },
          class: { $first: '$class' },
          section: { $first: '$section' },
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          attendancePercentage: {
            $multiply: [
              { $divide: ['$presentCount', '$totalClasses'] },
              100
            ]
          }
        }
      },
      {
        $match: {
          attendancePercentage: { $lt: parseFloat(threshold) }
        }
      },
      {
        $project: {
          _id: 0,
          studentId: 1,
          name: 1,
          class: 1,
          section: 1,
          totalClasses: 1,
          presentCount: 1,
          attendancePercentage: { $round: ['$attendancePercentage', 2] }
        }
      },
      {
        $sort: { attendancePercentage: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: lowAttendanceStudents,
      count: lowAttendanceStudents.length
    });
  } catch (error) {
    next(error);
  }
};

const getAttendanceSummary = async (req, res, next) => {
  try {
    const { class: className, section, startDate, endDate } = req.query;
    
    const matchStage = {};
    if (className) matchStage.class = className;
    if (section) matchStage.section = section;
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const summary = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAttendanceRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          excusedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] }
          },
          uniqueStudents: { $addToSet: '$student' }
        }
      },
      {
        $addFields: {
          totalStudents: { $size: '$uniqueStudents' },
          overallAttendancePercentage: {
            $multiply: [
              { $divide: ['$presentCount', '$totalAttendanceRecords'] },
              100
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalAttendanceRecords: 1,
          totalStudents: 1,
          presentCount: 1,
          absentCount: 1,
          lateCount: 1,
          excusedCount: 1,
          overallAttendancePercentage: { $round: ['$overallAttendancePercentage', 2] }
        }
      }
    ]);

    const result = summary[0] || {
      totalAttendanceRecords: 0,
      totalStudents: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      overallAttendancePercentage: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClassAttendanceAnalytics,
  getStudentAttendanceAnalytics,
  getMonthlyTrends,
  getTopPerformingClasses,
  getLowAttendanceStudents,
  getAttendanceSummary
};
