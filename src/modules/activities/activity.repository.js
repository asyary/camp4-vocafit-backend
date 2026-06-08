const db = require('../../config/db');

const createActivity = async (userId, data) => {
    const { taskName, note, targetValue, unit } = data;
    const { rows } = await db.query(
        'INSERT INTO activities (user_id, task_name, note, target_value, unit) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, taskName, note, targetValue, unit]
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
    const { taskName, isCompleted, note, currentValue, targetValue, unit } = data;
    
    // We use COALESCE to only update fields that are provided
    const { rows } = await db.query(
        `UPDATE activities 
         SET task_name = COALESCE($1, task_name), 
             is_completed = COALESCE($2, is_completed),
             note = COALESCE($3, note),
             current_value = COALESCE($4, current_value),
             target_value = COALESCE($5, target_value),
             unit = COALESCE($6, unit)
         WHERE id = $7 AND user_id = $8 
         RETURNING *`,
        [taskName, isCompleted, note, currentValue, targetValue, unit, id, userId]
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