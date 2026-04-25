const service = require('./pengurus.service');
const { newsSchema, trainerSchema, scheduleSchema, updateUserSchema, imageSchema } = require('./pengurus.validation');
const { paginationSchema } = require('../../utils/validation.util');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');
const db = require('../../config/db');

const createNews = async (req, res, next) => {
    try {
        const parsedBody = newsSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;
        
        const news = await service.addNews({ ...parsedBody, authorId: req.user.id }, fileBuffer);
        res.success(news, 'News created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getNews = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.getNews(page, limit);
        res.success(result.data, 'News retrieved successfully', 200, { page, limit, total: result.total_pages });
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

const createTrainer = async (req, res, next) => {
    try {
        const parsedBody = trainerSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;

        const trainer = await service.addTrainer(parsedBody, fileBuffer);
        res.success(trainer, 'Trainer created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getTrainers = async (req, res, next) => {
    try {
        const trainers = await service.getTrainers();
        res.success(trainers, 'Trainers retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const createSchedule = async (req, res, next) => {
    try {
        const parsedBody = scheduleSchema.parse(req.body);
        const schedule = await service.addSchedule(parsedBody);
        res.success(schedule, 'Schedule created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getUsers = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        
        const result = await service.getUsersList(page, limit);
        
        res.success(result.data, 'Users retrieved successfully', 200, { page, limit, total: result.total_pages });
    } catch (err) {
        next(err);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const parsedBody = updateUserSchema.parse(req.body);
        const updatedUser = await service.editUser(req.params.id, parsedBody);
        res.success(updatedUser, 'User updated successfully');
    } catch (err) {
        next(err);
    }
};

const updateUserImage = async (req, res, next) => {
    try {
        if (!req.file) throw new Error('New image file is required');

		const parsedFile = imageSchema.parse(req.file);
        
        const imageUrl = await uploadToCloudinary(parsedFile.buffer, 'users');
        
        const { rows } = await db.query(
            'UPDATE users SET profile_image_url = $1 WHERE id = $2 RETURNING id, full_name, profile_image_url',
            [imageUrl, req.params.id]
        );
        
        if (rows.length === 0) throw new Error('User not found');
        
        res.success(rows[0], 'User image updated successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createNews, getNews, deleteNews,
    createTrainer, getTrainers, createSchedule,
    getUsers, updateUser, updateUserImage
};