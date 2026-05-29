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

module.exports = { createNews, getAllNews, countAllNews, deleteNews };
