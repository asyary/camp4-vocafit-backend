const db = require('../../config/db');

const getAllUsers = async (limit, offset) => {
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
                        'end_date', m.end_date,
                        'plan_code', m.plan_code,
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
                u.phone_number,
                u.date_of_birth,
                u.profile_image_url,
                u.role,
                u.is_verified,
                (
                    SELECT json_build_object(
                        'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                        'end_date', m.end_date,
                        'plan_code', m.plan_code,
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
        const { email, passwordHash, fullName, phoneNumber, birthDate, role, membershipPriceCode, penaltyAmount, profileImageUrl } = data;

        const { rows: insertedRows } = await client.query(
            `INSERT INTO users (
                email,
                password,
                full_name,
                phone_number,
                date_of_birth,
                role,
                penalty_amount,
                profile_image_url,
                is_verified,
                verified_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
            RETURNING id, email, full_name, phone_number, date_of_birth, profile_image_url, role, is_verified, penalty_amount, created_at, updated_at`,
            [email, passwordHash, fullName, phoneNumber, birthDate, role, penaltyAmount || 0, profileImageUrl]
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
                    u.phone_number,
                    u.date_of_birth,
                    u.profile_image_url,
                    u.role,
                    u.is_verified,
                    u.penalty_amount,
                    u.created_at,
                    u.updated_at,
                    (
                        SELECT json_build_object(
                            'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                            'end_date', m.end_date,
                            'plan_code', m.plan_code,
                            'type', m.type
                        )
                        FROM memberships m
                        WHERE m.user_id = u.id AND m.canceled_at IS NULL
                        ORDER BY m.end_date DESC
                        LIMIT 1
                    ) AS membership,
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
        const { email, fullName, phoneNumber, birthDate, role, membershipPriceCode, penaltyAmount, passwordHash, profileImageUrl } = data;

        const { rows: updatedRows } = await client.query(
            `UPDATE users SET 
                email = COALESCE($1, email),
                full_name = COALESCE($2, full_name),
                phone_number = COALESCE($3, phone_number),
                date_of_birth = COALESCE($4, date_of_birth),
                role = COALESCE($5, role), 
                penalty_amount = COALESCE($6, penalty_amount),
                password = COALESCE($7, password),
                profile_image_url = COALESCE($8, profile_image_url),
                updated_at = NOW()
            WHERE id = $9
              AND is_verified = TRUE
            RETURNING id`,
            [email, fullName, phoneNumber, birthDate, role, penaltyAmount, passwordHash, profileImageUrl, id]
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
                    u.phone_number,
                    u.date_of_birth,
                    u.profile_image_url,
                    u.role,
                    u.is_verified,
                    u.penalty_amount,
                    u.created_at,
                    u.updated_at,
                    (
                        SELECT json_build_object(
                            'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                            'end_date', m.end_date,
                            'plan_code', m.plan_code,
                            'type', m.type
                        )
                        FROM memberships m
                        WHERE m.user_id = u.id AND m.canceled_at IS NULL
                        ORDER BY m.end_date DESC
                        LIMIT 1
                    ) AS membership,
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

const getDashboardCounts = async () => {
    const { rows: userRow } = await db.query(`SELECT COUNT(*) FROM users`);
    const { rows: newsRow } = await db.query(`SELECT COUNT(*) FROM news`);
    const { rows: trainerRow } = await db.query(`SELECT COUNT(*) FROM trainers WHERE is_active = TRUE`);
    
    const { rows: memberRows } = await db.query(`
        SELECT 
            COUNT(*) FILTER (WHERE has_membership = TRUE) as with_membership,
            COUNT(*) FILTER (WHERE has_membership = FALSE) as without_membership
        FROM (
            SELECT u.id, EXISTS (
                SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.end_date > NOW() AND m.canceled_at IS NULL
            ) as has_membership
            FROM users u
            WHERE u.role = 'member' AND u.is_verified = TRUE
        ) as sub
    `);

    return {
        total_users: parseInt(userRow[0].count, 10),
        total_news: parseInt(newsRow[0].count, 10),
        total_trainers: parseInt(trainerRow[0].count, 10),
        active_members_with_membership: parseInt(memberRows[0].with_membership, 10),
        active_members_without_membership: parseInt(memberRows[0].without_membership, 10)
    };
};

const getTransactionsLast30Days = async () => {
    const { rows } = await db.query(`
        SELECT DATE(created_at) as date, SUM(amount) as total_amount
        FROM transactions
        WHERE status = 'SUCCESS' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `);
    return rows;
};

const getLatestActivitiesToday = async () => {
    const { rows } = await db.query(`
        SELECT 'transaction' AS type, t.created_at AS time, u.full_name AS name, u.profile_image_url AS thumbnail_url, t.amount AS amount
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE t.status = 'SUCCESS' AND DATE(t.created_at) = CURRENT_DATE

        UNION ALL

        SELECT 'tap-in' AS type, v.tap_in_time AS time, u.full_name AS name, u.profile_image_url AS thumbnail_url, NULL AS amount
        FROM gym_visits v
        JOIN users u ON u.id = v.user_id
        WHERE DATE(v.tap_in_time) = CURRENT_DATE

        UNION ALL

        SELECT 'tap-out' AS type, v.tap_out_time AS time, u.full_name AS name, u.profile_image_url AS thumbnail_url, NULL AS amount
        FROM gym_visits v
        JOIN users u ON u.id = v.user_id
        WHERE v.tap_out_time IS NOT NULL AND DATE(v.tap_out_time) = CURRENT_DATE

        UNION ALL

        SELECT 'registration' AS type, u.created_at AS time, u.full_name AS name, u.profile_image_url AS thumbnail_url, NULL AS amount
        FROM users u
        WHERE DATE(u.created_at) = CURRENT_DATE AND u.is_verified = TRUE

        ORDER BY time DESC
    `);
    return rows;
};

const getLatestTransactions = async (limit) => {
    const { rows } = await db.query(`
        SELECT t.id, t.created_at AS time, u.full_name AS name, u.profile_image_url AS thumbnail_url, t.amount AS amount
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE t.status = 'SUCCESS'
        ORDER BY t.created_at DESC
        LIMIT $1
    `, [limit]);
    return rows;
};

const getTopTrainers = async (limit) => {
    const { rows } = await db.query(`
        SELECT 
            t.id, 
            t.name, 
            t.image_url, 
            COUNT(tp.id)::int as total_booking
        FROM trainers t
        LEFT JOIN trainer_packages tp ON t.id = tp.trainer_id AND tp.status != 'CANCELED'
        WHERE t.is_active = TRUE
        GROUP BY t.id, t.name, t.image_url
        ORDER BY total_booking DESC
        LIMIT $1
    `, [limit]);
    return rows;
};

module.exports = {
    getAllUsers, getUserById, createUser, updateUser, invalidateUser, countAllUsers,
    getDashboardCounts, getTransactionsLast30Days, getLatestActivitiesToday, getLatestTransactions, getTopTrainers
};