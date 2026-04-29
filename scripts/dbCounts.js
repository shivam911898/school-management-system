const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");

const uri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school-management";

(async function main() {
  try {
    console.log("Connecting to", uri);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const total = await User.countDocuments();
    const teachers = await User.countDocuments({ role: "teacher" });
    const students = await User.countDocuments({ role: "student" });
    const admins = await User.countDocuments({ role: "admin" });
    console.log("User counts:", { total, admins, teachers, students });
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
