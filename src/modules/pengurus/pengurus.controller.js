const service = require('./pengurus.service');
const { newsSchema, trainerSchema, scheduleSchema, updateUserSchema } = require('./pengurus.validation');
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
        res.status(400).json({ success: false, error: err.message });
    }
};

const getNews = async (req, res) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.getNews(page, limit);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.errors || err.message });
    }
};

const deleteNews = async (req, res) => {
    try {
        await service.removeNews(req.params.id);
        res.status(200).json({ success: true, message: 'News deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const createTrainer = async (req, res) => {
    try {
        const parsedBody = trainerSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;

        const trainer = await service.addTrainer(parsedBody, fileBuffer);
        res.status(201).json({ success: true, data: trainer });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const getTrainers = async (req, res) => {
    try {
        const trainers = await service.getTrainers();
        res.status(200).json({ success: true, data: trainers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const createSchedule = async (req, res) => {
    try {
        const parsedBody = scheduleSchema.parse(req.body);
        const schedule = await service.addSchedule(parsedBody);
        res.status(201).json({ success: true, data: schedule });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
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
        res.status(400).json({ success: false, error: err.errors || err.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const parsedBody = updateUserSchema.parse(req.body);
        const updatedUser = await service.editUser(req.params.id, parsedBody);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const updateUserImage = async (req, res) => {
    try {
        if (!req.file) throw new Error('New image file is required');
        
        const imageUrl = await uploadToCloudinary(req.file.buffer, 'users');
        
        const { rows } = await db.query(
            'UPDATE users SET profile_image_url = $1 WHERE id = $2 RETURNING id, full_name, profile_image_url',
            [imageUrl, req.params.id]
        );
        
        if (rows.length === 0) throw new Error('User not found');
        
        res.status(200).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

module.exports = {
    createNews, getNews, deleteNews,
    createTrainer, getTrainers, createSchedule,
    getUsers, updateUser, updateUserImage
};