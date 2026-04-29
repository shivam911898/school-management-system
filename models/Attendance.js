const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student is required']
    },
    class: {
      type: String,
      required: [true, 'Class is required']
    },
    section: {
      type: String,
      required: [true, 'Section is required']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required']
    },
    date: {
      type: Date,
      required: [true, 'Date is required']
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'present'
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher who marked attendance is required']
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 200
    },
    // For automatic attendance tracking
    checkInTime: {
      type: Date
    },
    checkOutTime: {
      type: Date
    },
    // Analytics fields
    semester: {
      type: String,
      default: function() {
        const date = new Date(this.date);
        const month = date.getMonth();
        if (month >= 0 && month <= 5) return 'Spring';
        if (month >= 6 && month <= 8) return 'Summer';
        return 'Fall';
      }
    },
    academicYear: {
      type: String,
      default: function() {
        const date = new Date(this.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        return month >= 0 && month <= 5 ? `${year-1}-${year}` : `${year}-${year+1}`;
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate attendance records
attendanceSchema.index({ student: 1, class: 1, section: 1, subject: 1, date: 1 }, { unique: true });

// Index for efficient queries
attendanceSchema.index({ class: 1, section: 1, date: 1 });
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ academicYear: 1, semester: 1 });
attendanceSchema.index({ class: 1, section: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
