const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

// Simplified dashboard controller with working aggregations
const getDashboardMetrics = async (req, res, next) => {
  try {
    const { class: className, section, dateRange = '30' } = req.query;
    
    // Build match conditions for filtering
    const userMatch = { role: 'student', isActive: true };
    const attendanceMatch = {};
    
    if (className) {
      userMatch.class = className;
      attendanceMatch.class = className;
    }
    
    if (section) {
      attendanceMatch.section = section;
    }
    
    // Date range filter for attendance
    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    attendanceMatch.date = { $gte: startDate };
    
    // Execute basic queries in parallel
    const [
      totalStudents,
      totalClasses,
      classDistribution,
      attendanceStats,
      classAttendanceBreakdown,
      lowAttendanceStudents
    ] = await Promise.all([
      // Total students
      User.countDocuments(userMatch),
      
      // Total classes
      Class.countDocuments({ isActive: true }),
      
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
              $multiply: [
                { $divide: ['$presentCount', '$totalRecords'] },
                100
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
              $multiply: [
                { $divide: ['$presentCount', '$totalRecords'] },
                100
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
      
      // Low attendance students (<75%)
      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: '$student',
            studentId: { $first: { $arrayElemAt: ['$student.studentId', 0] } },
            name: { $first: { $arrayElemAt: ['$student.name', 0] } },
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
            attendancePercentage: { $lt: 75 }
          }
        },
        { $sort: { attendancePercentage: 1 } },
        { $limit: 10 },
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
        }
      ])
    ]);
    
    // Generate section distribution from class data
    const sectionDistribution = classDistribution.reduce((acc, cls) => {
      const section = cls.class.slice(-1); // Get last character (A or B)
      const existing = acc.find(item => item.section === section);
      if (existing) {
        existing.totalStudents += cls.totalStudents;
      } else {
        acc.push({
          section,
          totalStudents: cls.totalStudents
        });
      }
      return acc;
    }, []);
    
    // Format response data
    const attendanceStatsData = attendanceStats[0] || {
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
        totalClasses,
        overallAttendance: attendanceStatsData.attendancePercentage,
        totalAttendanceRecords: attendanceStatsData.totalRecords,
        activeStudents: attendanceStatsData.uniqueStudents
      },
      distributions: {
        byClass: classDistribution,
        bySection: sectionDistribution
      },
      attendance: {
        stats: attendanceStatsData,
        classBreakdown: classAttendanceBreakdown,
        trends: [], // Simplified for now
        topPerformingClasses: classAttendanceBreakdown
          .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
          .slice(0, 5),
        lowAttendanceStudents
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
    console.error('Dashboard metrics error:', error);
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
            studentId: { $first: { $arrayElemAt: ['$student.studentId', 0] } },
            name: { $first: { $arrayElemAt: ['$student.name', 0] } },
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
            studentId: 1,
            name: 1,
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
    console.error('Class details error:', error);
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
      
      // Recent activity (last 24 hours)
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
    console.error('System health error:', error);
    next(error);
  }
};

module.exports = {
  getDashboardMetrics,
  getClassDetails,
  getSystemHealth
};
