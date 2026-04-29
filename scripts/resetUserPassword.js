require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const usage = () => {
  console.log("Usage: node scripts/resetUserPassword.js <email> <newPassword>");
  console.log(
    "Example: node scripts/resetUserPassword.js admin@school.com NewStrongPass@123",
  );
};

const validatePassword = (password) => {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
};

const main = async () => {
  const [, , emailArg, newPasswordArg] = process.argv;

  if (!emailArg || !newPasswordArg) {
    usage();
    process.exit(1);
  }

  const email = String(emailArg).trim().toLowerCase();
  const newPassword = String(newPasswordArg);

  validatePassword(newPassword);

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in environment");
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS:
      Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
  });

  const user = await User.findOne({ email }).select("_id role email");
  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        password: hashedPassword,
      },
    },
  );

  console.log(`Password reset successful for ${user.email} (${user.role})`);
};

main()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Password reset failed:", error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  });
