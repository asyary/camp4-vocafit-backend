const service = require('./notifications.service');
const { broadcastSchema } = require('./notifications.validation');
const { paginationSchema } = require('../../utils/validation.util');

const getMyNotifications = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.getNotificationsForUser(req.user.id, page, limit);
        res.success(result.data, 'Notifications retrieved successfully', 200, {
            page: result.page,
            limit: result.limit,
            total: result.total_pages,
            unread_count: result.unread_count
        });
    } catch (err) {
        next(err);
    }
};

const getUnreadCount = async (req, res, next) => {
    try {
        const count = await service.getUnreadCountForUser(req.user.id);
        res.success({ unread_count: count }, 'Unread count retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const markAllAsRead = async (req, res, next) => {
    try {
        const updated = await service.markAllRead(req.user.id);
        res.success({ updated_count: updated }, 'All notifications marked as read');
    } catch (err) {
        next(err);
    }
};

const broadcast = async (req, res, next) => {
    try {
        const { title, message, audience } = broadcastSchema.parse(req.body);
        const result = await service.broadcastNotification({
            title,
            message,
            audience,
            createdBy: req.user.id
        });
        res.success(
            { notification: result.notification, recipient_count: result.recipientCount },
            'Notification broadcasted successfully',
            201
        );
    } catch (err) {
        next(err);
    }
};

module.exports = { getMyNotifications, getUnreadCount, markAllAsRead, broadcast };
