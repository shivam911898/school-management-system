const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      unique: true
    },
    grade: {
      type: String,
      required: [true, 'Grade is required'],
      enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      uppercase: true,
      maxlength: 1
    },
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Class teacher is required']
    },
    subjects: [{
      type: String,
      required: true
    }],
    maxStudents: {
      type: Number,
      default: 40,
      min: 1,
      max: 100
    },
    currentStudents: {
      type: Number,
      default: 0
    },
    roomNumber: {
      type: String,
      trim: true
    },
    schedule: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        required: true
      },
      periods: [{
        subject: {
          type: String,
          required: true
        },
        teacher: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        startTime: {
          type: String,
          required: true
        },
        endTime: {
          type: String,
          required: true
        }
      }]
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    academicYear: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for unique class names within academic year
classSchema.index({ name: 1, academicYear: 1 }, { unique: true });

// Index for efficient queries
classSchema.index({ classTeacher: 1 });
classSchema.index({ grade: 1, section: 1 });
classSchema.index({ isActive: 1 });

module.exports = mongoose.model('Class', classSchema);
