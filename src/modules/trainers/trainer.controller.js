const service = require('./trainer.service');
const {
    trainerSchema,
    updateTrainerSchema,
    imageSchema,
    trainerIdParamSchema,
    packageIdParamSchema,
    sessionIdParamSchema,
    bookSessionSchema,
    cancelSessionSchema,
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
        const trainers = await service.getTrainers();
        res.success(trainers, 'Trainers retrieved successfully');
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
};