const db = require('../../config/db');

const getUserProfile = async (id) => {
    const { rows } = await db.query(
        'SELECT id, email, full_name, profile_image_url, role, monthly_price, penalty_amount, created_at FROM users WHERE id = $1',
        [id]
    );
    return rows[0];
};

const updateProfile = async (id, data) => {
    const { fullName, passwordHash } = data;
    const { rows } = await db.query(
        `UPDATE users 
         SET full_name = COALESCE($1, full_name), 
             password_hash = COALESCE($2, password_hash)
         WHERE id = $3 
         RETURNING id, email, full_name, profile_image_url`,
        [fullName, passwordHash, id]
    );
    return rows[0];
};

const deleteAccount = async (id) => {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
};

module.exports = { getUserProfile, updateProfile, deleteAccount };