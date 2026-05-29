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
         WHERE u.id = $1`,
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
            RETURNING id, email, full_name, profile_image_url, membership_price_code
        )
         SELECT updated.*, t.name AS tier
         FROM updated
         LEFT JOIN pricing_account_tiers t ON t.code = updated.membership_price_code`,
        [fullName, passwordHash, id]
    );
    return rows[0];
};

const deleteAccount = async (id) => {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
};

module.exports = { getUserProfile, updateProfile, deleteAccount };