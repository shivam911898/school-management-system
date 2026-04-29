const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/school-management';
const DEFAULT_SELECTION_TIMEOUT_MS = 5000;

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;
  const serverSelectionTimeoutMS =
    Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || DEFAULT_SELECTION_TIMEOUT_MS;

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS });
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return false;
  }
};

module.exports = {
  connectDB,
  isDatabaseReady
};
