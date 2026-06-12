const service = require('./news.service');
const { newsSchema, imageSchema } = require('./news.validation');
const { paginationSchema } = require('../../utils/validation.util');

const createNews = async (req, res, next) => {
    try {
        const parsedBody = newsSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;
        if (req.file) imageSchema.parse(req.file);

        const news = await service.addNews({ ...parsedBody, authorId: req.user.id }, fileBuffer);
        res.success(news, 'News created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const updateNews = async (req, res, next) => {
    try {
        const parsedBody = newsSchema.partial().parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;
        if (req.file) imageSchema.parse(req.file);

        const news = await service.editNews(req.params.id, parsedBody, fileBuffer);
        if (!news) {
            return res.status(404).json({ success: false, message: 'News not found' });
        }
        res.success(news, 'News updated successfully', 200);
    } catch (err) {
        next(err);
    }
};

const getNews = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.getNews(page, limit);
        res.success(result.data, 'News retrieved successfully', 200, { page, limit, total_pages: result.total_pages, total_data: result.total_data });
    } catch (err) {
        next(err);
    }
};

const getNewsById = async (req, res, next) => {
    try {
        const news = await service.getNewsById(req.params.id);
        if (!news) {
            return res.status(404).json({ success: false, message: 'News not found' });
        }
        res.success(news, 'News retrieved successfully', 200);
    } catch (err) {
        next(err);
    }
};

const deleteNews = async (req, res, next) => {
    try {
        await service.removeNews(req.params.id);
        res.success(null, 'News deleted successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = { createNews, updateNews, getNews, getNewsById, deleteNews };