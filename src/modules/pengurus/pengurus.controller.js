const service = require('./pengurus.service');
const { newsSchema, trainerSchema, scheduleSchema, updateUserSchema, imageSchema } = require('./pengurus.validation');
const { paginationSchema } = require('../../utils/validation.util');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');
const db = require('../../config/db');

const createNews = async (req, res) => {
    try {
        const parsedBody = newsSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;
        
        const news = await service.addNews({ ...parsedBody, authorId: req.user.id }, fileBuffer);
        res.status(201).json({ success: true, data: news });
    } catch (err) {
        next(err);
    }
};

const getNews = async (req, res) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.getNews(page, limit);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};

const deleteNews = async (req, res) => {
    try {
        await service.removeNews(req.params.id);
        res.status(200).json({ success: true, message: 'News deleted successfully' });
    } catch (err) {
        next(err);
    }
};

const createTrainer = async (req, res) => {
    try {
        const parsedBody = trainerSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;

        const trainer = await service.addTrainer(parsedBody, fileBuffer);
        res.status(201).json({ success: true, data: trainer });
    } catch (err) {
        next(err);
    }
};

const getTrainers = async (req, res) => {
    try {
        const trainers = await service.getTrainers();
        res.status(200).json({ success: true, data: trainers });
    } catch (err) {
        next(err);
    }
};

const createSchedule = async (req, res) => {
    try {
        const parsedBody = scheduleSchema.parse(req.body);
        const schedule = await service.addSchedule(parsedBody);
        res.status(201).json({ success: true, data: schedule });
    } catch (err) {
        next(err);
    }
};

const getUsers = async (req, res) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        
        const result = await service.getUsersList(page, limit);
        
        res.status(200).json({ 
            success: true, 
            ...result 
        });
    } catch (err) {
        next(err);
    }
};

const updateUser = async (req, res) => {
    try {
        const parsedBody = updateUserSchema.parse(req.body);
        const updatedUser = await service.editUser(req.params.id, parsedBody);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        next(err);
    }
};

const updateUserImage = async (req, res) => {
    try {
        if (!req.file) throw new Error('New image file is required');

		const parsedFile = imageSchema.parse(req.file);
        
        const imageUrl = await uploadToCloudinary(parsedFile.buffer, 'users');
        
        const { rows } = await db.query(
            'UPDATE users SET profile_image_url = $1 WHERE id = $2 RETURNING id, full_name, profile_image_url',
            [imageUrl, req.params.id]
        );
        
        if (rows.length === 0) throw new Error('User not found');
        
        res.status(200).json({ success: true, data: rows[0] });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createNews, getNews, deleteNews,
    createTrainer, getTrainers, createSchedule,
    getUsers, updateUser, updateUserImage
};