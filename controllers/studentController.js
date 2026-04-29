const Student = require("../models/Student");
const Class = require("../models/Class");
const User = require("../models/User");

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const syncStudentPhoneToUser = async (student) => {
  const namePattern = new RegExp(`^${escapeRegex(student.name)}$`, "i");

  const classNameMatches = await User.find({
    role: "student",
    class: student.className,
    name: namePattern,
  }).select("_id name class phone studentId isActive");

  let matches = classNameMatches;
  let matchedBy = "class+name";

  if (matches.length === 0 && student.rollNumber !== undefined) {
    const rollBasedMatches = await User.find({
      role: "student",
      studentId: String(student.rollNumber),
    }).select("_id name class phone studentId isActive");

    if (rollBasedMatches.length > 0) {
      matches = rollBasedMatches;
      matchedBy = "studentId(rollNumber)";
    }
  }

  if (matches.length === 0) {
    return {
      status: "not-found",
      matchedBy,
      message:
        "No matching student login account found. Add/update phone in User Management for this student account.",
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matchedBy,
      message:
        "Multiple student login accounts matched. Please update phone manually in User Management.",
    };
  }

  const matchedUser = matches[0];

  if (matchedUser.phone === student.phone) {
    return {
      status: "unchanged",
      matchedBy,
      userId: matchedUser._id,
      message: "Student login account already has the same phone number.",
    };
  }

  matchedUser.phone = student.phone;
  await matchedUser.save();

  return {
    status: "updated",
    matchedBy,
    userId: matchedUser._id,
    message: "Student login account phone synced successfully.",
  };
};

const getStudents = async (req, res, next) => {
  try {
    let students = [];

    if (req.user.role === "teacher") {
      const assignedClasses = await Class.find({
        classTeacher: req.user._id,
        isActive: true,
      })
        .select("name")
        .lean();

      const classNames = assignedClasses.map((item) => item.name);

      students = classNames.length
        ? await Student.find({ className: { $in: classNames } }).sort({
            className: 1,
            section: 1,
            rollNumber: 1,
          })
        : [];
    } else {
      students = await Student.find().sort({
        className: 1,
        section: 1,
        rollNumber: 1,
      });
    }

    res.status(200).json({
      success: true,
      count: students.length,
      scope: req.user.role === "teacher" ? "assigned-classes" : "all",
      students,
    });
  } catch (error) {
    next(error);
  }
};

const createStudent = async (req, res, next) => {
  try {
    const student = await Student.create(req.body);
    const sync = await syncStudentPhoneToUser(student);

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student,
      sync,
    });
  } catch (error) {
    next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const sync = await syncStudentPhoneToUser(student);

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student,
      sync,
    });
  } catch (error) {
    next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
};
