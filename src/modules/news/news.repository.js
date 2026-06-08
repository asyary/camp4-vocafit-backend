const db = require('../../config/db');

const createNews = async (data) => {
    const { title, summary, content, authorId, imageUrl } = data;
    const { rows } = await db.query(
        'INSERT INTO news (title, summary, content, author_id, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, summary, content, image_url, created_at',
        [title, summary, content, authorId, imageUrl]
    );
    return rows[0];
};

const updateNews = async (id, data) => {
    const { title, summary, content, imageUrl } = data;
    let query, values;
    if (imageUrl !== undefined) {
        query = 'UPDATE news SET title = $1, summary = $2, content = $3, image_url = $4 WHERE id = $5 RETURNING id, title, summary, content, image_url, created_at';
        values = [title, summary, content, imageUrl, id];
    } else {
        query = 'UPDATE news SET title = $1, summary = $2, content = $3 WHERE id = $4 RETURNING id, title, summary, content, image_url, created_at';
        values = [title, summary, content, id];
    }
    const { rows } = await db.query(query, values);
    return rows[0];
};

const getAllNews = async (limit, offset) => {
    const { rows } = await db.query(
        'SELECT id, title, summary, image_url, created_at FROM news ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    return rows;
};

const getNewsById = async (id) => {
    const { rows } = await db.query('SELECT id, title, summary, content, image_url, created_at FROM news WHERE id = $1', [id]);
    return rows[0];
};

const countAllNews = async () => {
    const { rows } = await db.query('SELECT COUNT(*) FROM news');
    return parseInt(rows[0].count, 10);
};

const deleteNews = async (id) => {
    await db.query('DELETE FROM news WHERE id = $1', [id]);
};

module.exports = { createNews, updateNews, getAllNews, getNewsById, countAllNews, deleteNews };
