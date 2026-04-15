const db = require('../../config/db');

const createActivity = async (userId, taskName) => {
    const { rows } = await db.query(
        'INSERT INTO activities (user_id, task_name) VALUES ($1, $2) RETURNING *',
        [userId, taskName]
    );
    return rows[0];
};

const getUserActivities = async (userId, limit, offset) => {
    const { rows } = await db.query(
        'SELECT * FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
    );
    return rows;
};

const countUserActivities = async (userId) => {
    const { rows } = await db.query(
        'SELECT COUNT(*) FROM activities WHERE user_id = $1',
        [userId]
    );
    return parseInt(rows[0].count, 10);
};

const getActivityByIdAndUser = async (id, userId) => {
    const { rows } = await db.query(
        'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
        [id, userId]
    );
    return rows[0];
};

const updateActivity = async (id, userId, data) => {
    const { taskName, isCompleted } = data;
    
    // We use COALESCE to only update fields that are provided
    const { rows } = await db.query(
        `UPDATE activities 
         SET task_name = COALESCE($1, task_name), 
             is_completed = COALESCE($2, is_completed)
         WHERE id = $3 AND user_id = $4 
         RETURNING *`,
        [taskName, isCompleted, id, userId]
    );
    return rows[0];
};

const deleteActivity = async (id, userId) => {
    const { rowCount } = await db.query(
        'DELETE FROM activities WHERE id = $1 AND user_id = $2',
        [id, userId]
    );
    return rowCount; // Returns the number of deleted rows (1 if successful, 0 if not found)
};

module.exports = {
    createActivity,
    getUserActivities,
    getActivityByIdAndUser,
    updateActivity,
    deleteActivity,
	countUserActivities
};