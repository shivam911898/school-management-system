const Class = require('../models/Class');
const User = require('../models/User');

// Create new class (admin only)
const createClass = async (req, res, next) => {
  try {
    const classData = req.body;

    // Check if class name already exists for this academic year
    const existingClass = await Class.findOne({ 
      name: classData.name, 
      academicYear: classData.academicYear 
    });
    if (existingClass) {
      return res.status(409).json({
        success: false,
        message: 'Class with this name already exists for this academic year'
      });
    }

    // Validate class teacher exists and is a teacher
    const classTeacher = await User.findById(classData.classTeacher);
    if (!classTeacher || classTeacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Invalid class teacher'
      });
    }

    const newClass = await Class.create(classData);
    await newClass.populate('classTeacher', 'name email employeeId');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: newClass
    });
  } catch (error) {
    next(error);
  }
};

// Get all classes (admin, teacher)
const getAllClasses = async (req, res, next) => {
  try {
    const { grade, academicYear, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };

    if (grade) filter.grade = grade;
    if (academicYear) filter.academicYear = academicYear;

    // Teachers can only see their assigned classes
    if (req.user.role === 'teacher') {
      filter.classTeacher = req.user._id;
    }

    const classes = await Class.find(filter)
      .populate('classTeacher', 'name email employeeId')
      .sort({ grade: 1, section: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Class.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        classes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get class by ID (with RBAC)
const getClassById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classData = await Class.findById(id)
      .populate('classTeacher', 'name email employeeId phone')
      .populate('schedule.periods.teacher', 'name email employeeId');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // RBAC: Teachers can only view their assigned classes
    if (req.user.role === 'teacher' && classData.classTeacher._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: classData
    });
  } catch (error) {
    next(error);
  }
};

// Update class (admin only)
const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // If updating class teacher, validate the new teacher
    if (updateData.classTeacher) {
      const newTeacher = await User.findById(updateData.classTeacher);
      if (!newTeacher || newTeacher.role !== 'teacher') {
        return res.status(400).json({
          success: false,
          message: 'Invalid class teacher'
        });
      }
    }

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('classTeacher', 'name email employeeId');

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });
  } catch (error) {
    next(error);
  }
};

// Delete class (admin only)
const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;

    // BUG FIX: Students store class as a name string, not an ObjectId.
    // Must look up the class name first before checking enrolled students.
    const classToDelete = await Class.findById(id);
    if (!classToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const studentsCount = await User.countDocuments({ 
      class: classToDelete.name, 
      role: 'student',
      isActive: true 
    });

    if (studentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with enrolled students'
      });
    }

    const classData = await Class.findByIdAndDelete(id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get students in a class (teacher/admin)
const getClassStudents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // RBAC: Teachers can only view students in their assigned classes
    if (req.user.role === 'teacher' && classData.classTeacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const students = await User.find({
      class: classData.name,
      role: 'student',
      isActive: true
    })
    .select('name studentId email phone dateOfBirth')
    .sort({ name: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await User.countDocuments({
      class: classData.name,
      role: 'student',
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        students,
        class: {
          _id: classData._id,
          name: classData.name,
          grade: classData.grade,
          section: classData.section
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Assign teacher to class (admin only)
const assignClassTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher'
      });
    }

    classData.classTeacher = teacherId;
    await classData.save();
    await classData.populate('classTeacher', 'name email employeeId');

    res.status(200).json({
      success: true,
      message: 'Class teacher assigned successfully',
      data: classData
    });
  } catch (error) {
    next(error);
  }
};

// Add subject to class (admin only)
const addSubjectToClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject } = req.body;

    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    if (classData.subjects.includes(subject)) {
      return res.status(400).json({
        success: false,
        message: 'Subject already exists in this class'
      });
    }

    classData.subjects.push(subject);
    await classData.save();

    res.status(200).json({
      success: true,
      message: 'Subject added successfully',
      data: classData
    });
  } catch (error) {
    next(error);
  }
};

// Get class schedule (teacher/admin)
const getClassSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classData = await Class.findById(id)
      .populate('schedule.periods.teacher', 'name email employeeId');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // RBAC: Teachers can only view their own class schedule
    if (req.user.role === 'teacher' && classData.classTeacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        class: {
          _id: classData._id,
          name: classData.name,
          grade: classData.grade,
          section: classData.section
        },
        schedule: classData.schedule
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  getClassStudents,
  assignClassTeacher,
  addSubjectToClass,
  getClassSchedule
};
