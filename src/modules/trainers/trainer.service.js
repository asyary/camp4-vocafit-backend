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

const addSchedule = async (data) => await repository.createSchedule(data);

module.exports = { addTrainer, getTrainers, addSchedule };