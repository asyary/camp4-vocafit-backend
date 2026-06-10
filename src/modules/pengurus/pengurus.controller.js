const service = require('./pengurus.service');
const { createUserSchema, updateUserSchema, imageSchema } = require('./pengurus.validation');
const { paginationSchema } = require('../../utils/validation.util');

const getMetrics = async (req, res, next) => {
    try {
        const metrics = await service.getDashboardMetrics();
        res.success(metrics, 'Dashboard metrics retrieved successfully');
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
        if (req.file) imageSchema.parse({ image: req.file });

        const updatedUser = await service.editUser(req.params.id, parsedBody, req.file ? req.file.buffer : null);
        res.success(updatedUser, 'User updated successfully');
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
    getMetrics, getUsers, getUser, createUser, updateUser, deleteUser
};