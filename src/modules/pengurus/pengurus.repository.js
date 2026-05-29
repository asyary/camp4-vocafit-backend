const db = require('../../config/db');

const getAllUsers = async (limit, offset) => {
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
         WHERE u.is_verified = TRUE
         ORDER BY u.created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return rows;
};

const countAllUsers = async () => {
    const { rows } = await db.query('SELECT COUNT(*) FROM users WHERE is_verified = TRUE');
    return parseInt(rows[0].count, 10);
};

const getUserById = async (id) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.full_name,
                u.profile_image_url,
                u.role,
                u.is_verified,
                t.name AS tier,
                u.membership_price_code,
                u.penalty_amount,
                u.created_at,
                u.updated_at
         FROM users u
         LEFT JOIN pricing_account_tiers t ON t.code = u.membership_price_code
                 WHERE u.id = $1
                     AND u.is_verified = TRUE`,
        [id]
    );

    return rows[0];
};

const createUser = async (data) => {
    const { email, passwordHash, fullName, role, membershipPriceCode, penaltyAmount, profileImageUrl } = data;
    const { rows } = await db.query(
        `WITH inserted AS (
            INSERT INTO users (
                email,
                password_hash,
                full_name,
                role,
                membership_price_code,
                penalty_amount,
                profile_image_url,
                is_verified,
                verified_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
            RETURNING id, email, full_name, profile_image_url, role, is_verified, membership_price_code, penalty_amount, created_at, updated_at
        )
         SELECT inserted.*, t.name AS tier
         FROM inserted
         LEFT JOIN pricing_account_tiers t ON t.code = inserted.membership_price_code`,
        [email, passwordHash, fullName, role, membershipPriceCode || null, penaltyAmount || 0, profileImageUrl]
    );

    return rows[0];
};

const updateUser = async (id, data) => {
    const { email, fullName, role, membershipPriceCode, penaltyAmount } = data;
    const { rows } = await db.query(
        `WITH updated AS (
            UPDATE users SET 
                email = COALESCE($1, email),
                full_name = COALESCE($2, full_name),
                role = COALESCE($3, role), 
                membership_price_code = COALESCE($4, membership_price_code),
                penalty_amount = COALESCE($5, penalty_amount),
                updated_at = NOW()
            WHERE id = $6
              AND is_verified = TRUE
            RETURNING id, email, full_name, profile_image_url, role, penalty_amount, membership_price_code, is_verified, created_at, updated_at
        )
         SELECT updated.*, t.name AS tier
         FROM updated
         LEFT JOIN pricing_account_tiers t ON t.code = updated.membership_price_code`,
        [email, fullName, role, membershipPriceCode, penaltyAmount, id]
    );
    return rows[0];
};

const invalidateUser = async (id) => {
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

module.exports = {
    getAllUsers, getUserById, createUser, updateUser, invalidateUser, countAllUsers
};