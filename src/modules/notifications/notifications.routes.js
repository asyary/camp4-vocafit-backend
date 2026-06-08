const express = require('express');
const controller = require('./notifications.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

// All notification routes require authentication
router.use(requireAuth);

// Member routes
router.get('/', controller.getMyNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/read', controller.markAllAsRead);

// Pengurus-only routes
router.post('/broadcast', requireRole('pengurus'), controller.broadcast);

module.exports = router;
