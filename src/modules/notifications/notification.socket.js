const { requireSocketAuth } = require('../../middlewares/socket.middleware');
const { buildSocketPayload } = require('../../utils/socket.util');

const NOTIFICATION_NAMESPACE = '/ws/notifications';
const NEW_NOTIFICATION_EVENT = 'new_notification';

let notificationNamespace;

const emitToUser = (userId, notification) => {
    if (!notificationNamespace) return;

    const payload = buildSocketPayload({
        namespace: NOTIFICATION_NAMESPACE,
        event: NEW_NOTIFICATION_EVENT,
        data: notification,
        emittedFrom: 'notification.socket'
    });

    notificationNamespace.to(`user:${userId}`).emit(NEW_NOTIFICATION_EVENT, payload);
};

const emitToUsers = (userIds, notification) => {
    if (!notificationNamespace) return;

    const payload = buildSocketPayload({
        namespace: NOTIFICATION_NAMESPACE,
        event: NEW_NOTIFICATION_EVENT,
        data: notification,
        emittedFrom: 'notification.socket'
    });

    for (const userId of userIds) {
        notificationNamespace.to(`user:${userId}`).emit(NEW_NOTIFICATION_EVENT, payload);
    }
};

const initNotificationSocket = (io) => {
    notificationNamespace = io.of(NOTIFICATION_NAMESPACE);

    notificationNamespace.use(requireSocketAuth);

    notificationNamespace.on('connection', (socket) => {
        const userId = socket.user.id;
        socket.join(`user:${userId}`);
    });
};

initNotificationSocket.emitToUser = emitToUser;
initNotificationSocket.emitToUsers = emitToUsers;

module.exports = initNotificationSocket;
