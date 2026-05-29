const db = require('../../config/db');

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

module.exports = { createTrainer, getAllTrainers, createSchedule };