const repository = require('./pengurus.repository');
const cloudinary = require('../../config/cloudinary');

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

const addNews = async (data, fileBuffer) => {
    let imageUrl = null;
    if (fileBuffer) {
        imageUrl = await uploadToCloudinary(fileBuffer, 'news');
    }
    return await repository.createNews({ ...data, imageUrl });
};

const getNews = async (page, limit) => {
    const offset = (page - 1) * limit;

    const [news, totalCount] = await Promise.all([
        repository.getAllNews(limit, offset),
        repository.countAllNews()
    ]);

    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        data: news
    };
};
const removeNews = async (id) => await repository.deleteNews(id);

const addTrainer = async (data, fileBuffer) => {
    let imageUrl = null;
    if (fileBuffer) {
        imageUrl = await uploadToCloudinary(fileBuffer, 'trainers');
    }
    return await repository.createTrainer({ ...data, imageUrl });
};

const getTrainers = async () => await repository.getAllTrainers();
const addSchedule = async (data) => await repository.createSchedule(data);
const getSchedules = async (trainerId) => await repository.getSchedulesByTrainer(trainerId);

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
        data: users
    };
};
const editUser = async (id, data) => await repository.updateUser(id, data);

module.exports = {
    addNews, getNews, removeNews,
    addTrainer, getTrainers, addSchedule, getSchedules,
    getUsersList, editUser
};