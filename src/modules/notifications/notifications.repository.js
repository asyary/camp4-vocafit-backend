const db = require('../../config/db');

const createNotification = async ({ type, audience, title, message, createdBy = null }) => {
    const { rows } = await db.query(
        `INSERT INTO notifications (type, audience, title, message, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [type, audience, title, message, createdBy]
    );
    return rows[0];
};

const createUserNotifications = async (notificationId, userIds, createdAt = null) => {
    if (!userIds.length) return 0;

    const { rowCount } = await db.query(
        `INSERT INTO user_notifications (user_id, notification_id, created_at)
         SELECT uid, $1, COALESCE($3, NOW())
         FROM unnest($2::uuid[]) AS uid
         ON CONFLICT (user_id, notification_id) DO NOTHING`,
        [notificationId, userIds, createdAt]
    );
    return rowCount;
};

const getUserNotifications = async (userId, limit, offset) => {
    const { rows } = await db.query(
        `SELECT
            un.id,
            un.is_read,
            un.created_at,
            n.id   AS notification_id,
            n.type,
            n.title,
            n.message
         FROM user_notifications un
         JOIN notifications n ON n.id = un.notification_id
         WHERE un.user_id = $1
           AND n.expires_at > NOW()
         ORDER BY un.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );
    return rows;
};

const countUserNotifications = async (userId) => {
    const { rows } = await db.query(
        `SELECT COUNT(*) FROM user_notifications un
         JOIN notifications n ON n.id = un.notification_id
         WHERE un.user_id = $1
           AND n.expires_at > NOW()`,
        [userId]
    );
    return parseInt(rows[0].count, 10);
};

const getUnreadCount = async (userId) => {
    const { rows } = await db.query(
        `SELECT COUNT(*) FROM user_notifications un
         JOIN notifications n ON n.id = un.notification_id
         WHERE un.user_id = $1
           AND un.is_read = FALSE
           AND n.expires_at > NOW()`,
        [userId]
    );
    return parseInt(rows[0].count, 10);
};

const markAllAsRead = async (userId) => {
    const { rowCount } = await db.query(
        `UPDATE user_notifications
         SET is_read = TRUE
         WHERE user_id = $1
           AND is_read = FALSE`,
        [userId]
    );
    return rowCount;
};

const getUserIdsByAudience = async (audience) => {
    let query;

    switch (audience) {
        case 'ALL':
            query = `SELECT id FROM users WHERE is_verified = TRUE`;
            break;

        case 'ACTIVE_MEMBERS':
            query = `
                SELECT DISTINCT u.id
                FROM users u
                JOIN memberships m ON m.user_id = u.id
                WHERE u.is_verified = TRUE
                  AND m.end_date > NOW()
                  AND m.canceled_at IS NULL`;
            break;

        case 'INACTIVE_MEMBERS':
            // Verified users who have NO active membership
            query = `
                SELECT u.id
                FROM users u
                LEFT JOIN memberships m
                    ON m.user_id = u.id
                    AND m.end_date > NOW()
                    AND m.canceled_at IS NULL
                WHERE u.is_verified = TRUE
                  AND m.id IS NULL`;
            break;

        default:
            return [];
    }

    const { rows } = await db.query(query);
    return rows.map((r) => r.id);
};

const getUsersWithMembershipEndingOn = async (date) => {
    const { rows } = await db.query(
        `SELECT DISTINCT u.id AS user_id, u.full_name, m.end_date
         FROM users u
         JOIN memberships m ON m.user_id = u.id
         WHERE m.end_date::date = $1::date
           AND m.canceled_at IS NULL
           AND u.is_verified = TRUE`,
        [date]
    );
    return rows;
};

const getUsersWithSessionsOn = async (date) => {
    const { rows } = await db.query(
        `SELECT DISTINCT
            u.id AS user_id,
            u.full_name,
            ts.start_time,
            t.name AS trainer_name
         FROM trainer_sessions ts
         JOIN trainer_packages tp ON tp.id = ts.package_id
         JOIN trainer_package_members tpm ON tpm.package_id = tp.id
         JOIN users u ON u.id = tpm.user_id
         JOIN trainers t ON t.id = ts.trainer_id
         WHERE ts.start_time::date = $1::date
           AND ts.status = 'BOOKED'
           AND tpm.status = 'CONFIRMED'
           AND u.is_verified = TRUE`,
        [date]
    );
    return rows;
};

const deleteExpiredNotifications = async () => {
    const { rowCount } = await db.query(
        `DELETE FROM notifications WHERE expires_at < NOW()`
    );
    return rowCount;
};

module.exports = {
    createNotification,
    createUserNotifications,
    getUserNotifications,
    countUserNotifications,
    getUnreadCount,
    markAllAsRead,
    getUserIdsByAudience,
    getUsersWithMembershipEndingOn,
    getUsersWithSessionsOn,
    deleteExpiredNotifications
};
