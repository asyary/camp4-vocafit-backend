const db = require('../../config/db');

const getAllUsers = async (limit, offset) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.full_name,
                u.profile_image_url,
                u.role,
                uat.account_tier_code AS membership_price_code,
                t.name AS tier,
                u.penalty_amount,
                u.created_at
         FROM users u
         LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
         LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code
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
                uat.account_tier_code AS membership_price_code,
                t.name AS tier,
                u.penalty_amount,
                u.created_at,
                u.updated_at
         FROM users u
         LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
         LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code
                 WHERE u.id = $1
                     AND u.is_verified = TRUE`,
        [id]
    );

    return rows[0];
};

const createUser = async (data) => {
    return await db.withTransaction(async (client) => {
        const { email, passwordHash, fullName, role, membershipPriceCode, penaltyAmount, profileImageUrl } = data;

        const { rows: insertedRows } = await client.query(
            `INSERT INTO users (
                email,
                password,
                full_name,
                role,
                penalty_amount,
                profile_image_url,
                is_verified,
                verified_at
            ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
            RETURNING id, email, full_name, profile_image_url, role, is_verified, penalty_amount, created_at, updated_at`,
            [email, passwordHash, fullName, role, penaltyAmount || 0, profileImageUrl]
        );

        const user = insertedRows[0];
        if (!user) return null;

        if (membershipPriceCode) {
            await client.query(
                `INSERT INTO user_account_tiers (user_id, account_tier_code)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id) DO UPDATE
                 SET account_tier_code = EXCLUDED.account_tier_code,
                     assigned_at = NOW()`,
                [user.id, membershipPriceCode]
            );
        }

        const { rows } = await client.query(
            `SELECT u.id,
                    u.email,
                    u.full_name,
                    u.profile_image_url,
                    u.role,
                    u.is_verified,
                    u.penalty_amount,
                    u.created_at,
                    u.updated_at,
                    uat.account_tier_code AS membership_price_code,
                    t.name AS tier
             FROM users u
             LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
             LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code
             WHERE u.id = $1`,
            [user.id]
        );

        return rows[0];
    });
};

const updateUser = async (id, data) => {
    return await db.withTransaction(async (client) => {
        const { email, fullName, role, membershipPriceCode, penaltyAmount, passwordHash, profileImageUrl } = data;

        const { rows: updatedRows } = await client.query(
            `UPDATE users SET 
                email = COALESCE($1, email),
                full_name = COALESCE($2, full_name),
                role = COALESCE($3, role), 
                penalty_amount = COALESCE($4, penalty_amount),
                password = COALESCE($5, password),
                profile_image_url = COALESCE($6, profile_image_url),
                updated_at = NOW()
            WHERE id = $7
              AND is_verified = TRUE
            RETURNING id`,
            [email, fullName, role, penaltyAmount, passwordHash, profileImageUrl, id]
        );

        if (!updatedRows[0]) return null;

        const hasMembershipPriceCode = Object.prototype.hasOwnProperty.call(data, 'membershipPriceCode');
        if (hasMembershipPriceCode) {
            if (membershipPriceCode) {
                await client.query(
                    `INSERT INTO user_account_tiers (user_id, account_tier_code)
                     VALUES ($1, $2)
                     ON CONFLICT (user_id) DO UPDATE
                     SET account_tier_code = EXCLUDED.account_tier_code,
                         assigned_at = NOW()`,
                    [id, membershipPriceCode]
                );
            } else {
                await client.query(
                    `DELETE FROM user_account_tiers WHERE user_id = $1`,
                    [id]
                );
            }
        }

        const { rows } = await client.query(
            `SELECT u.id,
                    u.email,
                    u.full_name,
                    u.profile_image_url,
                    u.role,
                    u.is_verified,
                    u.penalty_amount,
                    u.created_at,
                    u.updated_at,
                    uat.account_tier_code AS membership_price_code,
                    t.name AS tier
             FROM users u
             LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
             LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code
             WHERE u.id = $1`,
            [id]
        );

        return rows[0];
    });
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