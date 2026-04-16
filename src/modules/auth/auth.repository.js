const db = require('../../config/db');

const findByEmail = async (email) => {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
};

const createUser = async (userData) => {
    const { email, passwordHash, fullName, monthlyPrice, verificationToken, profileImageUrl } = userData;
    const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, full_name, monthly_price, verification_token, profile_image_url) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, full_name, role`,
        [email, passwordHash, fullName, monthlyPrice, verificationToken, profileImageUrl]
    );
    return rows[0];
};

const verifyUserInDb = async (token) => {
    const { rows } = await db.query(
        `UPDATE users SET is_verified = TRUE, verification_token = NULL 
         WHERE verification_token = $1 RETURNING id`,
        [token]
    );
    return rows[0];
};

module.exports = { findByEmail, createUser, verifyUserInDb };