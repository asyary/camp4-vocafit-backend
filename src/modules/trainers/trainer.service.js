const db = require('../../config/db');
const repository = require('./trainer.repository');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');

const addTrainer = async (data, fileBuffer) => {
    let imageUrl = null;
    if (fileBuffer) {
        imageUrl = await uploadToCloudinary(fileBuffer, 'trainers');
    }

    return await repository.createTrainer({ ...data, imageUrl });
};

const getTrainers = async () => await repository.getAllTrainers();

const getTrainerById = async (trainerId) => {
    const trainer = await repository.findTrainerById(trainerId);
    if (!trainer) {
        const error = new Error('Trainer not found');
        error.status = 404;
        throw error;
    }
    return trainer;
};

const updateTrainer = async (trainerId, data, fileBuffer) => {
    const existing = await repository.findTrainerById(trainerId);
    if (!existing) {
        const error = new Error('Trainer not found');
        error.status = 404;
        throw error;
    }

    let imageUrl;
    if (fileBuffer) {
        imageUrl = await uploadToCloudinary(fileBuffer, 'trainers');
    }

    return await repository.updateTrainer(trainerId, {
        ...data,
        ...(imageUrl !== undefined && { imageUrl }),
    });
};

const deactivateTrainer = async (trainerId) => {
    const existing = await repository.findTrainerById(trainerId);
    if (!existing) {
        const error = new Error('Trainer not found');
        error.status = 404;
        throw error;
    }
    return await repository.deactivateTrainer(trainerId);
};

const getMyPackages = async (userId) => {
    return await repository.listPackagesByUserId(userId);
};

const getPackageDetails = async (userId, role, packageId) => {
    const packageRow = role === 'pengurus'
        ? await repository.getPackageById(packageId)
        : await repository.getPackageByIdForUser(packageId, userId);

    if (!packageRow) {
        const error = new Error('Trainer package not found');
        error.status = 404;
        throw error;
    }

    const sessions = await repository.listSessionsByPackageId(packageId);
    return {
        ...packageRow,
        sessions
    };
};

const bookSession = async (userId, packageId, payload) => {
    return await db.withTransaction(async (client) => {
        return await repository.bookPackageSession(client, {
            packageId,
            userId,
            startTime: payload.startTime,
        });
    });
};

const cancelSession = async (userId, role, sessionId, payload) => {
    return await db.withTransaction(async (client) => {
        return await repository.cancelPackageSession(client, {
            sessionId,
            userId,
            role,
            cancelReason: payload.reason,
        });
    });
};

module.exports = {
    addTrainer,
    getTrainers,
    getTrainerById,
    updateTrainer,
    deactivateTrainer,
    getMyPackages,
    getPackageDetails,
    bookSession,
    cancelSession,
};