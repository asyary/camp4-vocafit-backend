const service = require('./pengurus.service');
const { createUserSchema, updateUserSchema, imageSchema } = require('./pengurus.validation');
const { paginationSchema } = require('../../utils/validation.util');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');
const db = require('../../config/db');

const getUsers = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        
        const result = await service.getUsersList(page, limit);
        
        res.success(result.data, 'Users retrieved successfully', 200, { page, limit, total: result.total_pages });
    } catch (err) {
        next(err);
    }
};

const getUser = async (req, res, next) => {
    try {
        const user = await service.getUserById(req.params.id);
        res.success(user, 'User retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const createUser = async (req, res, next) => {
    try {
        const parsedBody = createUserSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;

        const user = await service.addUser(parsedBody, fileBuffer);
        res.success(user, 'User created successfully', 201);
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
            'UPDATE users SET profile_image_url = $1 WHERE id = $2 AND is_verified = TRUE RETURNING id, full_name, profile_image_url',
            [imageUrl, req.params.id]
        );
        
        if (rows.length === 0) throw new Error('User not found');
        
        res.success(rows[0], 'User image updated successfully');
    } catch (err) {
        next(err);
    }
};

const deleteUser = async (req, res, next) => {
    try {
        const invalidatedUser = await service.removeUser(req.params.id);
        res.success(invalidatedUser, 'User invalidated successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getUsers, getUser, createUser, updateUser, deleteUser, updateUserImage
};