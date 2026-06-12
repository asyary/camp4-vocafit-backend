const repository = require('./pengurus.repository');
const cloudinary = require('../../config/cloudinary');
const bcrypt = require('bcrypt');
const { withProfileImageThumb, replaceWithImageThumb } = require('../../utils/image.util');

const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `vocafit/${folder}` },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        stream.end(fileBuffer);
    });
};

const getDashboardMetrics = async () => {
    const counts = await repository.getDashboardCounts();
    const transactionsChart = await repository.getTransactionsLast30Days();
    const latestActivitiesRaw = await repository.getLatestActivitiesToday();
    const latestTransactionsRaw = await repository.getLatestTransactions(5);
    const topTrainersRaw = await repository.getTopTrainers(3);

    const latest_activities = latestActivitiesRaw.map(activity => {
        if (!activity.thumbnail_url) return activity;
        return replaceWithImageThumb(activity, 'thumbnail_url', 'c_thumb,w_50,h_50,g_face');
    });

    const latest_transactions = latestTransactionsRaw.map(tx => {
        if (!tx.thumbnail_url) return tx;
        return replaceWithImageThumb(tx, 'thumbnail_url', 'c_thumb,w_50,h_50,g_face');
    });

    const top_trainers = topTrainersRaw.map(trainer => {
        if (!trainer.image_url) return trainer;
        return replaceWithImageThumb(trainer, 'image_url', 'c_thumb,w_50,h_50,g_face');
    });

    return {
        counts,
        transactions_chart: transactionsChart,
        latest_activities,
        latest_transactions,
        top_trainers
    };
};

const getUsersList = async (page, limit) => {
    const offset = (page - 1) * limit;

    // Run both queries concurrently
    const [users, totalCount] = await Promise.all([
        repository.getAllUsers(limit, offset),
        repository.countAllUsers()
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
        page,
        limit,
        total_pages: totalPages,
        total_data: totalCount,
        data: users.map(user => withProfileImageThumb(user))
    };
};

const getUserById = async (id) => {
    const user = await repository.getUserById(id);
    if (!user) throw new Error('User not found');
    return withProfileImageThumb(user);
};

const addUser = async (data, fileBuffer) => {
    if (!fileBuffer) throw new Error('User image is required');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const imageUrl = await uploadToCloudinary(fileBuffer, 'users');

    const newUser = await repository.createUser({
        ...data,
        passwordHash,
        profileImageUrl: imageUrl,
        penaltyAmount: data.penaltyAmount || 0
    });
    return withProfileImageThumb(newUser);
};

const editUser = async (id, data, fileBuffer) => {
    let passwordHash;
    if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 12);
    }

    let profileImageUrl;
    if (fileBuffer) {
        profileImageUrl = await uploadToCloudinary(fileBuffer, 'users');
    }

    const updatedUser = await repository.updateUser(id, {
        ...data,
        passwordHash,
        profileImageUrl
    });
    if (!updatedUser) throw new Error('User not found');
    return withProfileImageThumb(updatedUser);
};

const removeUser = async (id) => {
    const invalidatedUser = await repository.invalidateUser(id);
    if (!invalidatedUser) throw new Error('User not found');
    return invalidatedUser;
};

module.exports = {
    getDashboardMetrics, getUsersList, getUserById, addUser, editUser, removeUser
};