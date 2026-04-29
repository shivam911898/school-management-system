const admin = require('firebase-admin');
const User = require('../models/User');

const SUPPORTED_ROLES = ['student', 'teacher'];

let firebaseReady = false;
let firebaseDisabledReason = '';

const parseServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (_error) {
      firebaseDisabledReason = 'Invalid FIREBASE_SERVICE_ACCOUNT_JSON';
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    firebaseDisabledReason = 'Firebase env vars are missing';
    return null;
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n')
  };
};

const initializeFirebase = () => {
  if (firebaseReady) return true;
  if (admin.apps.length > 0) {
    firebaseReady = true;
    return true;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return false;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  firebaseReady = true;
  firebaseDisabledReason = '';
  return true;
};

const normalizeRoles = (roles = []) => {
  const input = Array.isArray(roles) ? roles : [roles];
  return [...new Set(input.filter((role) => SUPPORTED_ROLES.includes(role)))];
};

const getRoleTokens = async (roles = []) => {
  const normalizedRoles = normalizeRoles(roles);
  if (!normalizedRoles.length) {
    return [];
  }

  const users = await User.find({
    isActive: true,
    role: { $in: normalizedRoles },
    fcmTokens: { $exists: true, $ne: [] }
  }).select('fcmTokens');

  return [...new Set(users.flatMap((user) => user.fcmTokens || []).filter(Boolean))];
};

const sendToTokens = async ({ tokens = [], title, body, data = {} }) => {
  const normalizedTokens = [...new Set((tokens || []).filter(Boolean))];
  if (!normalizedTokens.length) {
    return {
      success: true,
      reason: 'No tokens registered',
      sentCount: 0,
      failedCount: 0
    };
  }

  if (!initializeFirebase()) {
    return {
      success: false,
      reason: firebaseDisabledReason || 'Firebase not configured',
      sentCount: 0,
      failedCount: normalizedTokens.length
    };
  }

  const payload = {
    tokens: normalizedTokens,
    notification: {
      title,
      body
    },
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]))
  };

  const result = await admin.messaging().sendEachForMulticast(payload);

  return {
    success: result.failureCount === 0,
    sentCount: result.successCount,
    failedCount: result.failureCount
  };
};

const sendToRoles = async ({ roles, title, body, data = {} }) => {
  const normalizedRoles = normalizeRoles(roles);
  if (!normalizedRoles.length) {
    return {
      success: false,
      reason: 'No valid roles provided',
      sentCount: 0,
      failedCount: 0
    };
  }

  const tokens = await getRoleTokens(normalizedRoles);
  if (!tokens.length) {
    return {
      success: true,
      reason: 'No registered devices for target roles',
      sentCount: 0,
      failedCount: 0
    };
  }
  return sendToTokens({ tokens, title, body, data });
};

const registerUserToken = async ({ userId, token }) => {
  await User.findByIdAndUpdate(
    userId,
    {
      $addToSet: {
        fcmTokens: token
      }
    },
    { new: false }
  );
};

const unregisterUserToken = async ({ userId, token }) => {
  await User.findByIdAndUpdate(
    userId,
    {
      $pull: {
        fcmTokens: token
      }
    },
    { new: false }
  );
};

module.exports = {
  sendToRoles,
  sendToTokens,
  registerUserToken,
  unregisterUserToken,
  normalizeRoles
};
