const db = require('../../config/db');

const getUserProfile = async (id) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.full_name,
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
    const { fullName, passwordHash } = data;
    const { rows } = await db.query(
        `WITH updated AS (
            UPDATE users 
            SET full_name = COALESCE($1, full_name), 
                password = COALESCE($2, password)
            WHERE id = $3
              AND is_verified = TRUE
            RETURNING id, email, full_name, profile_image_url, role
        )
         SELECT updated.id,
                updated.email,
                updated.full_name,
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
        [fullName, passwordHash, id]
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

module.exports = { getUserProfile, updateProfile, invalidateAccount };