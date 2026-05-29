const db = require('../../config/db');

const getUserProfile = async (id) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.full_name,
                u.profile_image_url,
                u.role,
                t.name AS tier,
                u.penalty_amount,
                u.created_at
         FROM users u
         LEFT JOIN pricing_account_tiers t ON t.code = u.membership_price_code
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
                password_hash = COALESCE($2, password_hash)
            WHERE id = $3
              AND is_verified = TRUE
            RETURNING id, email, full_name, profile_image_url, membership_price_code
        )
         SELECT updated.*, t.name AS tier
         FROM updated
         LEFT JOIN pricing_account_tiers t ON t.code = updated.membership_price_code`,
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