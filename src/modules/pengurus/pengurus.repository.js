const db = require('../../config/db');

const createNews = async (data) => {
    const { title, content, authorId, imageUrl } = data;
    const { rows } = await db.query(
        'INSERT INTO news (title, content, author_id, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, content, authorId, imageUrl]
    );
    return rows[0];
};

const getAllNews = async (limit, offset) => {
    const { rows } = await db.query(
        'SELECT * FROM news ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    return rows;
};

const countAllNews = async () => {
    const { rows } = await db.query('SELECT COUNT(*) FROM news');
    return parseInt(rows[0].count, 10);
};

const deleteNews = async (id) => {
    await db.query('DELETE FROM news WHERE id = $1', [id]);
};

const createTrainer = async (data) => {
    const { name, bio, imageUrl } = data;
    const { rows } = await db.query(
        'INSERT INTO trainers (name, bio, image_url) VALUES ($1, $2, $3) RETURNING *',
        [name, bio, imageUrl]
    );
    return rows[0];
};

const getAllTrainers = async () => {
    const { rows } = await db.query('SELECT * FROM trainers');
    return rows;
};

const createSchedule = async (data) => {
    const { trainerId, startTime, endTime } = data;
    const { rows } = await db.query(
        'INSERT INTO trainer_schedules (trainer_id, start_time, end_time) VALUES ($1, $2, $3) RETURNING *',
        [trainerId, startTime, endTime]
    );
    return rows[0];
};

const getSchedulesByTrainer = async (trainerId) => {
    const { rows } = await db.query(
        'SELECT * FROM trainer_schedules WHERE trainer_id = $1 ORDER BY start_time ASC',
        [trainerId]
    );
    return rows;
};

const getAllUsers = async (limit, offset) => {
    const { rows } = await db.query(
        `SELECT id, email, full_name, profile_image_url, role, monthly_price, penalty_amount, created_at 
         FROM users 
         ORDER BY created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return rows;
};

const countAllUsers = async () => {
    const { rows } = await db.query('SELECT COUNT(*) FROM users');
    return parseInt(rows[0].count, 10);
};

const updateUser = async (id, data) => {
    const { role, penaltyAmount } = data;
    const { rows } = await db.query(
        `UPDATE users SET 
            role = COALESCE($1, role), 
            penalty_amount = COALESCE($2, penalty_amount) 
         WHERE id = $3 RETURNING id, email, full_name, role, penalty_amount`,
        [role, penaltyAmount, id]
    );
    return rows[0];
};

module.exports = {
    createNews, getAllNews, deleteNews,
    createTrainer, getAllTrainers, createSchedule, getSchedulesByTrainer,
    getAllUsers, updateUser, countAllUsers, countAllNews
};