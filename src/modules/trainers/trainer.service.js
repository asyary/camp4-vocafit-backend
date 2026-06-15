const repository = require('./trainer.repository');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');

const createError = (message, status) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const addTrainer = async (data, fileBuffer) => {
    let imageUrl = null;
    if (fileBuffer) {
        imageUrl = await uploadToCloudinary(fileBuffer, 'trainers');
    } else {
		throw createError('Trainer image is required', 400);
	}

    return await repository.createTrainer({ ...data, imageUrl });
};

const getTrainers = async (page, limit) => {
    const offset = (page - 1) * limit;
    const { rows, totalCount } = await repository.getAllTrainers({ limit, offset });
    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        total_data: totalCount,
        data: rows
    };
};

const getTrainerById = async (trainerId) => {
    const trainer = await repository.findTrainerById(trainerId);
    if (!trainer) {
        throw createError('Trainer not found', 404);
    }
    return trainer;
};

const updateTrainer = async (trainerId, data, fileBuffer) => {
    const existing = await repository.findTrainerById(trainerId);
    if (!existing) {
        throw createError('Trainer not found', 404);
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
        throw createError('Trainer not found', 404);
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
        throw createError('Trainer package not found', 404);
    }

    const sessions = await repository.listSessionsByPackageId(packageId);
    return {
        ...packageRow,
        sessions
    };
};

const bookSession = async (userId, packageId, payload) => {
    return await repository.runInTransaction(async (client) => {
        // 1. Lock and validate package
        const pkg = await repository.getPackageForUpdate(client, packageId);
        if (!pkg) {
            throw createError('Trainer package not found', 404);
        }
        if (pkg.status !== 'ACTIVE') {
            throw createError('Trainer package is not active', 409);
        }
        if (new Date(pkg.expires_at).getTime() <= Date.now()) {
            throw createError('Trainer package has expired', 409);
        }
        if (Number(pkg.session_remaining) <= 0) {
            throw createError('Trainer package has no remaining sessions', 409);
        }

        // 2. Verify the user is a confirmed member of this package
        const isMember = await repository.isConfirmedPackageMember(packageId, userId, client);
        if (!isMember) {
            throw createError('You are not a member of this trainer package', 403);
        }

        // 3. Validate session time
        const sessionStart = new Date(payload.startTime);
        if (Number.isNaN(sessionStart.getTime())) {
            throw createError('Invalid session start time', 400);
        }

        const sessionEnd = new Date(sessionStart.getTime() + 2 * 60 * 60 * 1000);

        if (sessionStart.getTime() <= Date.now()) {
            throw createError('Trainer sessions must be booked for a future time', 400);
        }
        if (sessionEnd.getTime() > new Date(pkg.expires_at).getTime()) {
            throw createError('Session must end before the package expires', 409);
        }
        if (![0, 30].includes(sessionStart.getMinutes())) {
            throw createError('Trainer sessions must start on 30-minute intervals', 400);
        }

        // 4. Create the session
        const session = await repository.insertSession(client, {
            packageId,
            trainerId: pkg.trainer_id,
            bookedByUserId: userId,
            startTime: sessionStart,
            endTime: sessionEnd,
        });

        // 5. Decrement remaining sessions
        const updatedPackage = await repository.updatePackageAfterSessionChange(client, packageId, -1);

        return { session, package: updatedPackage };
    });
};

const cancelSession = async (userId, role, sessionId, payload) => {
    return await repository.runInTransaction(async (client) => {
        // 1. Lock and fetch session with package info
        const session = await repository.getSessionWithPackageForUpdate(client, sessionId);
        if (!session) {
            throw createError('Trainer session not found', 404);
        }
        if (session.status !== 'BOOKED') {
            throw createError('Only booked sessions can be cancelled', 409);
        }
        if (session.package_status === 'CANCELED' || session.package_status === 'EXPIRED') {
            throw createError('Trainer package is no longer active', 409);
        }

        // 2. Session time must still be in the future for everyone
        const sessionStart = new Date(session.start_time);
        if (sessionStart.getTime() <= Date.now()) {
            throw createError('Session time has already been reached', 409);
        }

        // 3. Authorization checks for non-admin users
        if (role !== 'pengurus') {
            // D-2 check: members cannot cancel on D-1 or D-day
            const canCancel = await repository.canMemberCancelSession(sessionId, client);
            if (!canCancel) {
                throw createError('Trainer sessions can only be cancelled until D-2 by members', 409);
            }

            // Must be a confirmed member of the package
            const isMember = await repository.isConfirmedPackageMember(session.package_id, userId, client);
            if (!isMember) {
                throw createError('You are not allowed to cancel this trainer session', 403);
            }
        }

        // 4. Cancel the session
        const updatedSession = await repository.markSessionCancelled(client, sessionId, {
            canceledByUserId: userId,
            canceledByRole: role,
            cancelReason: payload.reason,
        });

        // 5. Restore the session slot back to the package
        const updatedPackage = await repository.restorePackageSession(client, session.package_id);

        return { session: updatedSession, package: updatedPackage };
    });
};

const mapSessionRow = (row, includeUser) => {
    const {
        trainer_id,
        trainer_name,
        trainer_email,
        trainer_phone_number,
        booked_by_user_id,
        booked_by_name,
        ...rest
    } = row;

    const mapped = {
        ...rest,
        trainer: {
            id: trainer_id,
            name: trainer_name,
            email: trainer_email,
            phone_number: trainer_phone_number,
        },
    };

    if (includeUser) {
        mapped.user = {
            id: booked_by_user_id,
            name: booked_by_name,
        };
    }

    return mapped;
};

const getAllSessions = async (page, limit, startDate, endDate) => {
    const offset = (page - 1) * limit;
    const { rows, totalCount } = await repository.getAllSessions({ limit, offset, startDate, endDate });
    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        total_data: totalCount,
        data: rows.map((row) => mapSessionRow(row, true)),
    };
};

const getSessionsByTrainerId = async (trainerId, page, limit, startDate, endDate) => {
    const trainer = await repository.findTrainerById(trainerId);
    if (!trainer) {
        throw createError('Trainer not found', 404);
    }
    const offset = (page - 1) * limit;
    const { rows, totalCount } = await repository.getSessionsByTrainerId(trainerId, { limit, offset, startDate, endDate });
    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        total_data: totalCount,
        data: rows.map((row) => mapSessionRow(row, true)),
    };
};

const getSessionsByTrainerIdForMember = async (trainerId, userId, page, limit, startDate, endDate) => {
    const trainer = await repository.findTrainerById(trainerId);
    if (!trainer) {
        throw createError('Trainer not found', 404);
    }

    const offset = (page - 1) * limit;
    const { rows, totalCount } = await repository.getSessionsByTrainerId(trainerId, { limit, offset, startDate, endDate });
    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        total_data: totalCount,
        data: rows.map((row) => mapSessionRow(row, false)),
    };
};

const getMySessionsAsBooker = async (userId, page, limit, startDate, endDate) => {
    const offset = (page - 1) * limit;
    const { rows, totalCount } = await repository.getMySessionsAsBooker(userId, { limit, offset, startDate, endDate });
    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        total_data: totalCount,
        data: rows.map((row) => mapSessionRow(row, false)),
    };
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
    getAllSessions,
    getSessionsByTrainerId,
    getSessionsByTrainerIdForMember,
    getMySessionsAsBooker,
};