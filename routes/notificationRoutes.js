const express = require('express');
const {
  registerDeviceToken,
  unregisterDeviceToken,
  sendRoleNotification
} = require('../controllers/notificationController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/token', protect, registerDeviceToken);
router.delete('/token', protect, unregisterDeviceToken);
router.post('/send', protect, requireAdmin, sendRoleNotification);

module.exports = router;
