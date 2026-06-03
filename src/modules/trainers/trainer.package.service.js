const db = require('../../config/db');
const repository = require('./trainer.package.repository');

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
    getMyPackages,
    getPackageDetails,
    bookSession,
    cancelSession,
};