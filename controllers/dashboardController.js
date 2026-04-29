const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

// Optimized dashboard aggregation with MongoDB pipelines
const getDashboardMetrics = async (req, res, next) => {
  try {
    const { class: className, section, dateRange = '30' } = req.query;

    const userMatch = { role: 'student', isActive: true };
    const attendanceMatch = {};

    if (className) {
      userMatch.class = className;
      attendanceMatch.class = className;
    }

    if (section) {
      attendanceMatch.section = section;
    }

    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    attendanceMatch.date = { $gte: startDate };

    // BUG FIX #2: Properly destructure sectionDistribution from Promise.all
    const [
      totalStudents,
      classDistribution,
      sectionDistribution,       // was: Promise.resolve([]) assigned to wrong variable
      classAttendanceBreakdown,
      attendanceTrends,
      topPerformingClasses,
      lowAttendanceStudents
    ] = await Promise.all([
      // Total students
      User.countDocuments(userMatch),

      // Students per class
      User.aggregate([
        { $match: userMatch },
        {
          $group: {
            _id: '$class',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            class: '$_id',
            totalStudents: '$count'
          }
        }
      ]),

      // BUG FIX #2: Section distribution now properly computed
      User.aggregate([
        { $match: userMatch },
        {
          $group: {
            _id: '$class',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            section: '$_id',
            count: 1
          }
        }
      ]),

      // Overall attendance statistics
      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
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
            uniqueStudentCount: { $size: '$uniqueStudents' },
            attendancePercentage: {
              $cond: [
                { $gt: ['$totalRecords', 0] },
                { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
                0
              ]
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalRecords: 1,
            uniqueStudents: '$uniqueStudentCount',
            presentCount: 1,
            absentCount: 1,
            lateCount: 1,
            excusedCount: 1,
            attendancePercentage: { $round: ['$attendancePercentage', 2] }
          }
        }
      ]),

      // Class-wise attendance breakdown
      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: {
              class: '$class',
              section: '$section'
            },
            totalRecords: { $sum: 1 },
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
              $cond: [
                { $gt: ['$totalRecords', 0] },
                { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { '_id.class': 1, '_id.section': 1 } },
        {
          $project: {
            _id: 0,
            class: '$_id.class',
            section: '$_id.section',
            totalRecords: 1,
            presentCount: 1,
            absentCount: 1,
            lateCount: 1,
            excusedCount: 1,
            attendancePercentage: { $round: ['$attendancePercentage', 2] }
          }
        }
      ]),

      // Attendance trends over time
      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              class: '$class'
            },
            totalRecords: { $sum: 1 },
            presentCount: {
              $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            attendancePercentage: {
              $cond: [
                { $gt: ['$totalRecords', 0] },
                { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            overallPercentage: { $avg: '$attendancePercentage' },
            classBreakdown: {
              $push: {
                class: '$_id.class',
                percentage: '$attendancePercentage'
              }
            }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            overallPercentage: { $round: ['$overallPercentage', 2] },
            classBreakdown: 1
          }
        }
      ]),

      // Top performing classes
      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: {
              class: '$class',
              section: '$section'
            },
            totalRecords: { $sum: 1 },
            presentCount: {
              $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            attendancePercentage: {
              $cond: [
                { $gt: ['$totalRecords', 0] },
                { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { attendancePercentage: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            class: '$_id.class',
            section: '$_id.section',
            attendancePercentage: { $round: ['$attendancePercentage', 2] },
            totalRecords: 1,
            presentCount: 1
          }
        }
      ]),

      // BUG FIX #6: Low attendance students — use $lookup to resolve student name/ID
      // instead of $arrayElemAt on scalar fields which always returned null
      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: '$student',
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
              $cond: [
                { $gt: ['$totalClasses', 0] },
                { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
                0
              ]
            }
          }
        },
        {
          $match: {
            attendancePercentage: { $lt: 75 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'studentInfo'
          }
        },
        { $unwind: { path: '$studentInfo', preserveNullAndEmpty: false } },
        { $sort: { attendancePercentage: 1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            studentId: '$studentInfo.studentId',
            name: '$studentInfo.name',
            class: 1,
            section: 1,
            totalClasses: 1,
            presentCount: 1,
            attendancePercentage: { $round: ['$attendancePercentage', 2] }
          }
        }
      ])
    ]);

    const attendanceStatsData = classAttendanceBreakdown[0] ? {
      totalRecords: 0,
      uniqueStudents: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      attendancePercentage: 0
    } : {
      totalRecords: 0,
      uniqueStudents: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      attendancePercentage: 0
    };

    // Recalculate overall stats from classAttendanceBreakdown
    const overallStats = await Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          lateCount: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          excusedCount: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
          uniqueStudents: { $addToSet: '$student' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRecords: 1,
          presentCount: 1,
          absentCount: 1,
          lateCount: 1,
          excusedCount: 1,
          uniqueStudents: { $size: '$uniqueStudents' },
          attendancePercentage: {
            $cond: [
              { $gt: ['$totalRecords', 0] },
              { $round: [{ $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] }, 2] },
              0
            ]
          }
        }
      }
    ]);

    const finalAttendanceStats = overallStats[0] || {
      totalRecords: 0,
      uniqueStudents: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      attendancePercentage: 0
    };

    const dashboardData = {
      summary: {
        totalStudents,
        totalClasses: await Class.countDocuments({ isActive: true }),
        overallAttendance: finalAttendanceStats.attendancePercentage,
        totalAttendanceRecords: finalAttendanceStats.totalRecords,
        activeStudents: finalAttendanceStats.uniqueStudents
      },
      distributions: {
        byClass: classDistribution,
        bySection: sectionDistribution   // BUG FIX #2: now a real value, not undefined
      },
      attendance: {
        stats: finalAttendanceStats,
        classBreakdown: classAttendanceBreakdown,
        trends: attendanceTrends,
        topPerformingClasses,
        lowAttendanceStudents         // BUG FIX #6: now contains real names/IDs
      },
      filters: {
        class: className,
        section,
        dateRange
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    next(error);
  }
};

// Get detailed class information
const getClassDetails = async (req, res, next) => {
  try {
    const { className } = req.params;

    const classData = await Class.findOne({ name: className, isActive: true })
      .populate('classTeacher', 'name email employeeId')
      .lean();

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const [students, recentAttendance] = await Promise.all([
      User.find({ class: className, role: 'student', isActive: true })
        .select('studentId name email dateOfBirth isActive')
        .sort({ name: 1 })
        .lean(),

      // BUG FIX #6: Use $lookup to properly resolve student name/ID instead of $arrayElemAt on scalar
      Attendance.aggregate([
        {
          $match: {
            class: className,
            date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: '$student',
            totalClasses: { $sum: 1 },
            presentCount: {
              $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
            },
            absentCount: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
            },
            lastAttendance: { $last: '$date' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'studentInfo'
          }
        },
        { $unwind: { path: '$studentInfo', preserveNullAndEmpty: false } },
        {
          $addFields: {
            attendancePercentage: {
              $cond: [
                { $gt: ['$totalClasses', 0] },
                { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
                0
              ]
            }
          }
        },
        {
          $project: {
            _id: 0,
            studentId: '$studentInfo.studentId',
            name: '$studentInfo.name',
            totalClasses: 1,
            presentCount: 1,
            absentCount: 1,
            attendancePercentage: { $round: ['$attendancePercentage', 2] },
            lastAttendance: 1
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        class: classData,
        students,
        recentAttendance
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get system health metrics
const getSystemHealth = async (req, res, next) => {
  try {
    const [totalUsers, activeUsers, totalClasses, totalAttendance, recentActivity] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Class.countDocuments({ isActive: true }),
      Attendance.countDocuments(),

      Attendance.aggregate([
        {
          $match: {
            date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            presentCount: {
              $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
            },
            uniqueStudents: { $addToSet: '$student' }
          }
        },
        {
          $project: {
            _id: 0,
            totalRecords: 1,
            presentCount: 1,
            activeStudents: { $size: '$uniqueStudents' }
          }
        }
      ])
    ]);

    const recentActivityData = recentActivity[0] || {
      totalRecords: 0,
      presentCount: 0,
      activeStudents: 0
    };

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers
        },
        classes: {
          total: totalClasses
        },
        attendance: {
          totalRecords: totalAttendance,
          todayActivity: recentActivityData
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardMetrics,
  getClassDetails,
  getSystemHealth
};
