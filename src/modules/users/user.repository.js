const db = require('../../config/db');

const getUserProfile = async (id) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.full_name,
                u.phone_number,
                u.date_of_birth,
                u.profile_image_url,
                u.role,
                (
                    SELECT json_build_object(
                        'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                        'endDate', m.end_date,
                        'planCode', m.plan_code,
                        'type', m.type
                    )
                    FROM memberships m
                    WHERE m.user_id = u.id AND m.canceled_at IS NULL
                    ORDER BY m.end_date DESC
                    LIMIT 1
                ) AS membership,
                uat.account_tier_code AS membership_price_code,
                t.name AS tier,
                u.penalty_amount,
                u.created_at
         FROM users u
         LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
         LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code
                 WHERE u.id = $1
                     AND u.is_verified = TRUE`,
        [id]
    );
    return rows[0];
};

const updateProfile = async (id, data) => {
    const { fullName, phoneNumber } = data;
    const { rows } = await db.query(
        `WITH updated AS (
            UPDATE users 
            SET full_name = COALESCE($1, full_name), 
                phone_number = COALESCE($2, phone_number)
            WHERE id = $3
              AND is_verified = TRUE
            RETURNING id, email, full_name, phone_number, date_of_birth, profile_image_url, role
        )
         SELECT updated.id,
                updated.email,
                updated.full_name,
                updated.phone_number,
                updated.date_of_birth,
                updated.profile_image_url,
                updated.role,
                (
                    SELECT json_build_object(
                        'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                        'endDate', m.end_date,
                        'planCode', m.plan_code,
                        'type', m.type
                    )
                    FROM memberships m
                    WHERE m.user_id = updated.id AND m.canceled_at IS NULL
                    ORDER BY m.end_date DESC
                    LIMIT 1
                ) AS membership,
                uat.account_tier_code AS membership_price_code,
                t.name AS tier
         FROM updated
         LEFT JOIN user_account_tiers uat ON uat.user_id = updated.id
         LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code`,
        [fullName, phoneNumber, id]
    );
    return rows[0];
};

const invalidateAccount = async (id) => {
    return await db.withTransaction(async (client) => {
        const { rows } = await client.query(
            `UPDATE users
             SET is_verified = FALSE,
                 verified_at = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, full_name, role`,
            [id]
        );

        const user = rows[0];
        if (!user) return null;

        await client.query(
            `UPDATE auth_challenges
             SET status = 'EXPIRED',
                 expired_at = COALESCE(expired_at, NOW()),
                 updated_at = NOW()
             WHERE email = $1
               AND status = 'PENDING'`,
            [user.email]
        );

        return user;
    });
};

const getUserPassword = async (id) => {
    const { rows } = await db.query(
        `SELECT password FROM users WHERE id = $1 AND is_verified = TRUE`,
        [id]
    );
    return rows[0]?.password;
};

const updatePassword = async (id, passwordHash) => {
    await db.query(
        `UPDATE users
         SET password = $1, updated_at = NOW()
         WHERE id = $2 AND is_verified = TRUE`,
        [passwordHash, id]
    );
};

const getActiveSessions = async (userId) => {
    const { rows } = await db.query(
        `SELECT id, ip_address, city, country, device_type, user_agent, created_at, last_active_at
         FROM user_sessions
         WHERE user_id = $1 AND is_active = TRUE
         ORDER BY last_active_at DESC`,
        [userId]
    );
    return rows;
};

const revokeSession = async (userId, sessionId) => {
    const { rows } = await db.query(
        `UPDATE user_sessions
         SET is_active = FALSE
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [sessionId, userId]
    );
    return rows[0];
};

module.exports = { getUserProfile, updateProfile, invalidateAccount, getUserPassword, updatePassword, getActiveSessions, revokeSession };