const service = require('./trainer.service');
const { paginationSchema } = require('../../utils/validation.util');
const {
    trainerSchema,
    updateTrainerSchema,
    imageSchema,
    trainerIdParamSchema,
    packageIdParamSchema,
    sessionIdParamSchema,
    bookSessionSchema,
    cancelSessionSchema,
    sessionQuerySchema,
} = require('./trainer.validation');

const createTrainer = async (req, res, next) => {
    try {
        const parsedBody = trainerSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;
        if (req.file) imageSchema.parse(req.file);

        const trainer = await service.addTrainer(parsedBody, fileBuffer);
        res.success(trainer, 'Trainer created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getTrainers = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.getTrainers(page, limit);
        res.success(result.data, 'Trainers retrieved successfully', 200, { page, limit, total_pages: result.total_pages, total_data: result.total_data });
    } catch (err) {
        next(err);
    }
};

const getTrainerById = async (req, res, next) => {
    try {
        const { trainerId } = trainerIdParamSchema.parse(req.params);
        const trainer = await service.getTrainerById(trainerId);
        res.success(trainer, 'Trainer retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const updateTrainer = async (req, res, next) => {
    try {
        const { trainerId } = trainerIdParamSchema.parse(req.params);
        const parsedBody = updateTrainerSchema.parse(req.body);
        const fileBuffer = req.file ? req.file.buffer : null;
        if (req.file) imageSchema.parse(req.file);

        const trainer = await service.updateTrainer(trainerId, parsedBody, fileBuffer);
        res.success(trainer, 'Trainer updated successfully');
    } catch (err) {
        next(err);
    }
};

const deactivateTrainer = async (req, res, next) => {
    try {
        const { trainerId } = trainerIdParamSchema.parse(req.params);
        const trainer = await service.deactivateTrainer(trainerId);
        res.success(trainer, 'Trainer deactivated successfully');
    } catch (err) {
        next(err);
    }
};

const getMyPackages = async (req, res, next) => {
    try {
        const packages = await service.getMyPackages(req.user.id);
        res.success(packages, 'Trainer packages retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const getPackageDetails = async (req, res, next) => {
    try {
        const { packageId } = packageIdParamSchema.parse(req.params);
        const packageDetails = await service.getPackageDetails(req.user.id, req.user.role, packageId);
        res.success(packageDetails, 'Trainer package retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const bookSession = async (req, res, next) => {
    try {
        const { packageId } = packageIdParamSchema.parse(req.params);
        const parsedBody = bookSessionSchema.parse(req.body);
        const result = await service.bookSession(req.user.id, packageId, parsedBody);
        res.success(result, 'Trainer session booked successfully', 201);
    } catch (err) {
        next(err);
    }
};

const cancelSession = async (req, res, next) => {
    try {
        const { sessionId } = sessionIdParamSchema.parse(req.params);
        const parsedBody = cancelSessionSchema.parse(req.body);
        const result = await service.cancelSession(req.user.id, req.user.role, sessionId, parsedBody);
        res.success(result, 'Trainer session cancelled successfully');
    } catch (err) {
        next(err);
    }
};

const getAllSessions = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const { startDate, endDate } = sessionQuerySchema.parse(req.query);
        const result = await service.getAllSessions(page, limit, startDate, endDate);
        res.success(result.data, 'Sessions retrieved successfully', 200, { page, limit, total_pages: result.total_pages, total_data: result.total_data });
    } catch (err) {
        next(err);
    }
};

const getSessionsByTrainerId = async (req, res, next) => {
    try {
        const { trainerId } = trainerIdParamSchema.parse(req.params);
        const { page, limit } = paginationSchema.parse(req.query);
        const { startDate, endDate } = sessionQuerySchema.parse(req.query);
        const result = await service.getSessionsByTrainerId(trainerId, page, limit, startDate, endDate);
        res.success(result.data, 'Trainer sessions retrieved successfully', 200, { page, limit, total_pages: result.total_pages, total_data: result.total_data });
    } catch (err) {
        next(err);
    }
};

const getSessionsByTrainerIdForMember = async (req, res, next) => {
    try {
        const { trainerId } = trainerIdParamSchema.parse(req.params);
        const { page, limit } = paginationSchema.parse(req.query);
        const { startDate, endDate } = sessionQuerySchema.parse(req.query);
        const result = await service.getSessionsByTrainerIdForMember(trainerId, req.user.id, page, limit, startDate, endDate);
        res.success(result.data, 'Trainer sessions retrieved successfully', 200, { page, limit, total_pages: result.total_pages, total_data: result.total_data });
    } catch (err) {
        next(err);
    }
};

const getMySessions = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const { startDate, endDate } = sessionQuerySchema.parse(req.query);
        const result = await service.getMySessionsAsBooker(req.user.id, page, limit, startDate, endDate);
        res.success(result.data, 'My sessions retrieved successfully', 200, { page, limit, total_pages: result.total_pages, total_data: result.total_data });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createTrainer,
    getTrainers,
    getTrainerById,
    updateTrainer,
    deactivateTrainer,
    getMyPackages,
    getPackageDetails,
    bookSession,
    cancelSession,
    getAllSessions,
    getSessionsByTrainerId,
    getSessionsByTrainerIdForMember,
    getMySessions,
};