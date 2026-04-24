const db = require('../../config/db');

const getActiveVisit = async (userId) => {
    const { rows } = await db.query(
        `SELECT * FROM gym_visits 
         WHERE user_id = $1 AND tap_out_time IS NULL`,
        [userId]
    );
    return rows[0];
};

const createTapIn = async (userId, qrToken) => {
    const { rows } = await db.query(
        `INSERT INTO gym_visits (user_id, tap_in_time, qr_token) 
         VALUES ($1, NOW(), $2) RETURNING *`,
        [userId, qrToken]
    );
    return rows[0];
};

const updateTapOut = async (visitId) => {
    const { rows } = await db.query(
        `UPDATE gym_visits SET tap_out_time = NOW() 
         WHERE id = $1 RETURNING *`,
        [visitId]
    );
    return rows[0];
};

const getCrowdCount = async () => {
    const { rows } = await db.query(
        `SELECT COUNT(*) as count FROM gym_visits WHERE tap_out_time IS NULL`
    );
    return parseInt(rows[0].count, 10);
};

// Used by the Cron Job
const applyPenaltyAndAutoTapOut = async () => {
    // Find all users still in the gym
    const { rows: activeVisits } = await db.query(
        `SELECT id, user_id FROM gym_visits WHERE tap_out_time IS NULL`
    );

    if (activeVisits.length === 0) return 0;

    const userIds = activeVisits.map(v => v.user_id);
    const visitIds = activeVisits.map(v => v.id);

    // Add 5k penalty to those users
    await db.query(
        `UPDATE users SET penalty_amount = penalty_amount + 5000 WHERE id = ANY($1::uuid[])`,
        [userIds]
    );

    // Auto tap-out so they don't get penalized twice for the same visit tomorrow
    await db.query(
        `UPDATE gym_visits SET tap_out_time = NOW() WHERE id = ANY($1::uuid[])`,
        [visitIds]
    );

    return userIds.length;
};

module.exports = {
    getActiveVisit,
    createTapIn,
    updateTapOut,
    getCrowdCount,
    applyPenaltyAndAutoTapOut
};