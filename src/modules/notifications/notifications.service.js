const repository = require('./notifications.repository');
const { emitToUser, emitToUsers } = require('./notification.socket');

const broadcastNotification = async ({ title, message, audience, createdBy }) => {
    const notification = await repository.createNotification({
        type: 'BROADCAST',
        audience,
        title,
        message,
        createdBy
    });

    const userIds = await repository.getUserIdsByAudience(audience);

    if (userIds.length > 0) {
        await repository.createUserNotifications(notification.id, userIds, notification.created_at);

        // Real-time push via WebSocket
        emitToUsers(userIds, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            created_at: notification.created_at
        });
    }

    return { notification, recipientCount: userIds.length };
};

const getNotificationsForUser = async (userId, page, limit) => {
    const offset = (page - 1) * limit;

    const [notifications, totalCount, unreadCount] = await Promise.all([
        repository.getUserNotifications(userId, limit, offset),
        repository.countUserNotifications(userId),
        repository.getUnreadCount(userId)
    ]);

    return {
        data: notifications,
        unread_count: unreadCount,
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit)
    };
};

const getUnreadCountForUser = async (userId) => {
    return await repository.getUnreadCount(userId);
};

const markAllRead = async (userId) => {
    const updated = await repository.markAllAsRead(userId);
    return updated;
};

const sendMembershipExpiryReminders = async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatDate = (d) => d.toISOString().split('T')[0];

    // Membership ending today
    const endingToday = await repository.getUsersWithMembershipEndingOn(formatDate(today));
    if (endingToday.length > 0) {
        const notification = await repository.createNotification({
            type: 'MEMBERSHIP_EXPIRY_TODAY',
            audience: 'SINGLE_USER',
            title: 'Membership Berakhir Hari Ini',
            message: 'Membership kamu berakhir hari ini. Perpanjang sekarang agar tetap bisa akses gym!'
        });

        const userIds = endingToday.map((u) => u.user_id);
        await repository.createUserNotifications(notification.id, userIds, notification.created_at);

        emitToUsers(userIds, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            created_at: notification.created_at
        });
    }

    // Membership ending tomorrow
    const endingTomorrow = await repository.getUsersWithMembershipEndingOn(formatDate(tomorrow));
    if (endingTomorrow.length > 0) {
        const notification = await repository.createNotification({
            type: 'MEMBERSHIP_EXPIRY_TOMORROW',
            audience: 'SINGLE_USER',
            title: 'Membership Berakhir Besok',
            message: 'Membership kamu akan berakhir besok. Perpanjang sekarang agar tidak terputus!'
        });

        const userIds = endingTomorrow.map((u) => u.user_id);
        await repository.createUserNotifications(notification.id, userIds, notification.created_at);

        emitToUsers(userIds, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            created_at: notification.created_at
        });
    }

    return {
        endingToday: endingToday.length,
        endingTomorrow: endingTomorrow.length
    };
};

const sendSessionReminders = async () => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    const usersWithSessions = await repository.getUsersWithSessionsOn(formatDate(today));

    if (usersWithSessions.length === 0) return 0;

    // Group sessions by user so each user gets one notification
    const sessionsByUser = new Map();
    for (const row of usersWithSessions) {
        if (!sessionsByUser.has(row.user_id)) {
            sessionsByUser.set(row.user_id, []);
        }
        sessionsByUser.get(row.user_id).push(row);
    }

    let notifiedCount = 0;

    for (const [userId, sessions] of sessionsByUser) {
        const sessionList = sessions
            .map((s) => {
                const time = new Date(s.start_time).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Jakarta'
                });
                return `${time} bersama ${s.trainer_name}`;
            })
            .join(', ');

        const notification = await repository.createNotification({
            type: 'SESSION_REMINDER',
            audience: 'SINGLE_USER',
            title: 'Sesi Latihan Hari Ini',
            message: `Kamu punya sesi hari ini: ${sessionList}. Jangan lupa datang tepat waktu!`
        });

        await repository.createUserNotifications(notification.id, [userId], notification.created_at);

        emitToUser(userId, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            created_at: notification.created_at
        });

        notifiedCount++;
    }

    return notifiedCount;
};

const purgeExpiredNotifications = async () => {
    return await repository.deleteExpiredNotifications();
};

const TRANSACTION_TEMPLATES = {
    TRANSACTION_CREATED: (itemName, amount) => ({
        title: 'Pesanan Dibuat',
        message: `Pesanan ${itemName} sebesar Rp${Number(amount).toLocaleString('id-ID')} berhasil dibuat. Segera selesaikan pembayaran sebelum kedaluwarsa.`
    }),
    TRANSACTION_SUCCESS: (itemName, amount) => ({
        title: 'Pembayaran Berhasil',
        message: `Pembayaran ${itemName} sebesar Rp${Number(amount).toLocaleString('id-ID')} telah berhasil. Terima kasih!`
    }),
    TRANSACTION_FAILED: (itemName, amount) => ({
        title: 'Pembayaran Gagal',
        message: `Pembayaran ${itemName} sebesar Rp${Number(amount).toLocaleString('id-ID')} gagal atau dibatalkan. Silakan coba lagi.`
    })
};

const sendTransactionNotification = async ({ userId, type, itemName, amount }) => {
    try {
        const template = TRANSACTION_TEMPLATES[type];
        if (!template) return;

        const { title, message } = template(itemName, amount);

        const notification = await repository.createNotification({
            type,
            audience: 'SINGLE_USER',
            title,
            message
        });

        await repository.createUserNotifications(notification.id, [userId], notification.created_at);

        emitToUser(userId, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            created_at: notification.created_at
        });
    } catch (error) {
        console.error(`[Notification] Failed to send ${type} notification:`, error.message || error);
    }
};

module.exports = {
    broadcastNotification,
    getNotificationsForUser,
    getUnreadCountForUser,
    markAllRead,
    sendMembershipExpiryReminders,
    sendSessionReminders,
    purgeExpiredNotifications,
    sendTransactionNotification
};
