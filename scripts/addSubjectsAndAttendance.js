const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

// Define subjects for each class
const subjectsByClass = {
  '10A': ['Mathematics', 'Physics', 'Chemistry', 'English', 'Computer Science'],
  '10B': ['Mathematics', 'Physics', 'Chemistry', 'English', 'Hindi'],
  '9A': ['Mathematics', 'Physics', 'Biology', 'English', 'History'],
  '9B': ['Mathematics', 'Chemistry', 'Biology', 'English', 'Geography'],
  '8A': ['Mathematics', 'Physics', 'Chemistry', 'English', 'Computer Science'],
  '8B': ['Mathematics', 'Physics', 'Biology', 'English', 'History'],
  '7A': ['Mathematics', 'Chemistry', 'Biology', 'English', 'Geography'],
  '7B': ['Mathematics', 'Physics', 'Chemistry', 'English', 'Hindi']
};

async function addSubjectsToClasses() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('Adding subjects to classes...');
    const classes = await Class.find({});
    
    for (const classData of classes) {
      const subjects = subjectsByClass[classData.name] || [];
      await Class.findByIdAndUpdate(classData._id, { 
        subjects,
        currentStudents: await User.countDocuments({ 
          class: classData.name, 
          role: 'student',
          isActive: true 
        })
      });
      console.log(`Added subjects to ${classData.name}: ${subjects.join(', ')}`);
    }
    
    console.log('Subjects added successfully to all classes');
    return classes;
  } catch (error) {
    console.error('Error adding subjects:', error);
    throw error;
  }
}

async function generateAttendanceData() {
  try {
    console.log('Generating attendance data for all students...');
    
    // Get all classes with their subjects
    const classes = await Class.find({});
    const teachers = await User.find({ role: 'teacher', isActive: true });
    const students = await User.find({ role: 'student', isActive: true });
    
    console.log(`Found ${classes.length} classes, ${teachers.length} teachers, ${students.length} students`);
    
    // Clear existing attendance data
    await Attendance.deleteMany({});
    console.log('Cleared existing attendance data');
    
    // Generate attendance for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const attendanceRecords = [];
    let recordCount = 0;
    
    for (const classData of classes) {
      const classStudents = students.filter(s => s.class === classData.name);
      const classSubjects = classData.subjects || subjectsByClass[classData.name] || [];
      
      console.log(`Generating attendance for ${classData.name} - ${classStudents.length} students`);
      
      for (const student of classStudents) {
        for (const subject of classSubjects) {
          // Generate attendance for each day in the last 30 days
          for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            // Random attendance status with realistic distribution
            const random = Math.random();
            let status;
            if (random < 0.85) {
              status = 'present'; // 85% present
            } else if (random < 0.92) {
              status = 'late'; // 7% late
            } else if (random < 0.98) {
              status = 'absent'; // 6% absent
            } else {
              status = 'excused'; // 2% excused
            }
            
            // Extract section from class name
            const section = classData.name.slice(-1); // A or B
            
            attendanceRecords.push({
              student: student._id,
              class: classData.name,
              section: section,
              subject: subject,
              date: new Date(date),
              status: status,
              markedBy: classData.classTeacher || teachers[0], // Use class teacher or first teacher
              remarks: status === 'absent' ? 'Absent without prior notice' : 
                     status === 'late' ? 'Late arrival' : 
                     status === 'excused' ? 'Excused with permission' : '',
              checkInTime: status === 'present' || status === 'late' ? 
                new Date(date.getTime() + Math.random() * 3600000) : null, // Random check-in within first hour
              checkOutTime: status === 'present' ? 
                new Date(date.getTime() + 6 * 3600000 + Math.random() * 3600000) : null // Random check-out after 6-7 hours
            });
            
            recordCount++;
          }
        }
      }
    }
    
    console.log(`Generated ${recordCount} attendance records`);
    
    // Insert in batches to avoid memory issues
    const batchSize = 1000;
    for (let i = 0; i < attendanceRecords.length; i += batchSize) {
      const batch = attendanceRecords.slice(i, i + batchSize);
      await Attendance.insertMany(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(attendanceRecords.length/batchSize)} (${batch.length} records)`);
    }
    
    console.log('Attendance data generation completed successfully!');
    return recordCount;
  } catch (error) {
    console.error('Error generating attendance data:', error);
    throw error;
  }
}

async function generateSummary() {
  try {
    const totalRecords = await Attendance.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalClasses = await Class.countDocuments();
    const totalTeachers = await User.countDocuments({ role: 'teacher', isActive: true });
    
    // Get attendance statistics
    const stats = await Attendance.aggregate([
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
          }
        }
      }
    ]);
    
    const statistics = stats[0] || {
      totalRecords: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0
    };
    
    const overallAttendancePercentage = totalRecords > 0 ? 
      (statistics.presentCount / totalRecords * 100).toFixed(2) : 0;
    
    console.log('\n=== ATTENDANCE SYSTEM SUMMARY ===');
    console.log(`Total Students: ${totalStudents}`);
    console.log(`Total Teachers: ${totalTeachers}`);
    console.log(`Total Classes: ${totalClasses}`);
    console.log(`Total Attendance Records: ${totalRecords}`);
    console.log(`Present: ${statistics.presentCount} (${((statistics.presentCount/totalRecords)*100).toFixed(1)}%)`);
    console.log(`Absent: ${statistics.absentCount} (${((statistics.absentCount/totalRecords)*100).toFixed(1)}%)`);
    console.log(`Late: ${statistics.lateCount} (${((statistics.lateCount/totalRecords)*100).toFixed(1)}%)`);
    console.log(`Excused: ${statistics.excusedCount} (${((statistics.excusedCount/totalRecords)*100).toFixed(1)}%)`);
    console.log(`Overall Attendance Rate: ${overallAttendancePercentage}%`);
    console.log('===================================\n');
    
    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalRecords,
      statistics,
      overallAttendancePercentage
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

async function main() {
  try {
    await addSubjectsToClasses();
    await generateAttendanceData();
    const summary = await generateSummary();
    
    await mongoose.connection.close();
    console.log('Script completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
