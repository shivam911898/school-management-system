const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');
const Class = require('../models/Class');

const classes = [
  { name: '10A', grade: '10', section: 'A', academicYear: '2024-2025' },
  { name: '10B', grade: '10', section: 'B', academicYear: '2024-2025' },
  { name: '9A', grade: '9', section: 'A', academicYear: '2024-2025' },
  { name: '9B', grade: '9', section: 'B', academicYear: '2024-2025' },
  { name: '8A', grade: '8', section: 'A', academicYear: '2024-2025' },
  { name: '8B', grade: '8', section: 'B', academicYear: '2024-2025' },
  { name: '7A', grade: '7', section: 'A', academicYear: '2024-2025' },
  { name: '7B', grade: '7', section: 'B', academicYear: '2024-2025' }
];

const subjects = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 
  'Hindi', 'History', 'Geography', 'Computer Science', 'Physical Education'
];

const teachers = [
  { name: 'Sarah Johnson', email: 'sarah.j@school.com', employeeId: 'T001', subjects: ['Mathematics', 'Physics'] },
  { name: 'Michael Chen', email: 'michael.c@school.com', employeeId: 'T002', subjects: ['Chemistry', 'Biology'] },
  { name: 'Emily Rodriguez', email: 'emily.r@school.com', employeeId: 'T003', subjects: ['English', 'History'] },
  { name: 'David Kumar', email: 'david.k@school.com', employeeId: 'T004', subjects: ['Computer Science', 'Mathematics'] },
  { name: 'Lisa Anderson', email: 'lisa.a@school.com', employeeId: 'T005', subjects: ['Geography', 'History'] },
  { name: 'James Wilson', email: 'james.w@school.com', employeeId: 'T006', subjects: ['Physics', 'Chemistry'] },
  { name: 'Maria Garcia', email: 'maria.g@school.com', employeeId: 'T007', subjects: ['Biology', 'Geography'] },
  { name: 'Robert Taylor', email: 'robert.t@school.com', employeeId: 'T008', subjects: ['English', 'Hindi'] },
  { name: 'Jennifer Lee', email: 'jennifer.l@school.com', employeeId: 'T009', subjects: ['Physical Education', 'Mathematics'] },
  { name: 'Ahmed Hassan', email: 'ahmed.h@school.com', employeeId: 'T010', subjects: ['History', 'Geography'] },
  { name: 'Sophie Martin', email: 'sophie.m@school.com', employeeId: 'T011', subjects: ['Chemistry', 'Physics'] },
  { name: 'Thomas Brown', email: 'thomas.b@school.com', employeeId: 'T012', subjects: ['Computer Science', 'English'] },
  { name: 'Nina Patel', email: 'nina.p@school.com', employeeId: 'T013', subjects: ['Biology', 'Chemistry'] },
  { name: 'Carlos Sanchez', email: 'carlos.s@school.com', employeeId: 'T014', subjects: ['Mathematics', 'Physical Education'] },
  { name: 'Rachel Green', email: 'rachel.g@school.com', employeeId: 'T015', subjects: ['Hindi', 'History'] },
  { name: 'Kevin White', email: 'kevin.w@school.com', employeeId: 'T016', subjects: ['Geography', 'Biology'] },
  { name: 'Amanda Foster', email: 'amanda.f@school.com', employeeId: 'T017', subjects: ['English', 'Computer Science'] },
  { name: 'Daniel Kim', email: 'daniel.k@school.com', employeeId: 'T018', subjects: ['Physics', 'Mathematics'] },
  { name: 'Priya Sharma', email: 'priya.s@school.com', employeeId: 'T019', subjects: ['Chemistry', 'Biology'] },
  { name: 'Mark Thompson', email: 'mark.t@school.com', employeeId: 'T020', subjects: ['History', 'Geography'] },
  { name: 'Olivia Davis', email: 'olivia.d@school.com', employeeId: 'T021', subjects: ['English', 'Hindi'] },
  { name: 'Lucas Martinez', email: 'lucas.m@school.com', employeeId: 'T022', subjects: ['Physical Education', 'Mathematics'] }
];

const firstNames = ['Arjun', 'Priya', 'Rahul', 'Anjali', 'Vikram', 'Kavita', 'Rohit', 'Meera', 'Amit', 'Sneha', 'Karan', 'Pooja', 'Raj', 'Neha', 'Aditya', 'Ishita', 'Vivek', 'Divya', 'Rohit', 'Tanvi'];
const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Reddy', 'Joshi', 'Mehta', 'Shah', 'Pandey', 'Agarwal', 'Mishra', 'Verma', 'Chopra', 'Malhotra', 'Kapoor', 'Khanna', 'Bansal', 'Chaturvedi'];

async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('Clearing existing data...');
    await User.deleteMany({ role: { $in: ['teacher', 'student'] } });
    await Class.deleteMany({});
    
    console.log('Creating teachers...');
    const teacherPasswords = teachers.map(() => 'teacher123');
    const hashedTeacherPasswords = await Promise.all(teacherPasswords.map(pwd => bcrypt.hash(pwd, 12)));
    
    const teachersData = teachers.map((teacher, index) => ({
      ...teacher,
      password: hashedTeacherPasswords[index],
      role: 'teacher',
      phone: `9876543${String(index + 1).padStart(2, '0')}`,
      address: `${index + 1} Teacher Street, School City`,
      isActive: true
    }));
    
    const createdTeachers = await User.insertMany(teachersData);
    console.log(`Created ${createdTeachers.length} teachers`);
    
    console.log('Creating classes...');
    const classesWithTeachers = classes.map((classData, index) => ({
      ...classData,
      classTeacher: createdTeachers[index % createdTeachers.length]._id,
      subjects: createdTeachers[index % createdTeachers.length].subjects
    }));
    
    const createdClasses = await Class.insertMany(classesWithTeachers);
    console.log(`Created ${createdClasses.length} classes`);
    
    console.log('Creating students...');
    const students = [];
    let studentIdCounter = 1001;
    
    for (let classIndex = 0; classIndex < createdClasses.length; classIndex++) {
      const classInfo = createdClasses[classIndex];
      const studentsPerClass = 25 + Math.floor(Math.random() * 10); // 25-35 students per class
      
      for (let i = 0; i < studentsPerClass; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const studentId = `STU${String(studentIdCounter).padStart(4, '0')}`;
        
        // Generate random date of birth (age 14-18)
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - (14 + Math.floor(Math.random() * 5));
        const birthMonth = Math.floor(Math.random() * 12) + 1;
        const birthDay = Math.floor(Math.random() * 28) + 1;
        const dateOfBirth = new Date(birthYear, birthMonth - 1, birthDay);
        
        students.push({
          name: `${firstName} ${lastName}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${studentIdCounter}@school.com`,
          password: await bcrypt.hash('student123', 12),
          role: 'student',
          studentId,
          class: classInfo.name,
          dateOfBirth,
          phone: `9876543${String(studentIdCounter).padStart(4, '0').slice(-4)}`,
          address: `${studentIdCounter} Student Lane, School City`,
          isActive: true
        });
        
        studentIdCounter++;
      }
    }
    
    const createdStudents = await User.insertMany(students);
    console.log(`Created ${createdStudents.length} students`);
    
    console.log('Assigning class teachers...');
    for (let i = 0; i < Math.min(createdTeachers.length, createdClasses.length); i++) {
      await Class.findByIdAndUpdate(createdClasses[i]._id, {
        classTeacher: createdTeachers[i]._id,
        subjects: createdTeachers[i].subjects
      });
    }
    
    console.log('Database seeding completed successfully!');
    console.log(`Summary:`);
    console.log(`- Classes: ${createdClasses.length}`);
    console.log(`- Teachers: ${createdTeachers.length}`);
    console.log(`- Students: ${createdStudents.length}`);
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
