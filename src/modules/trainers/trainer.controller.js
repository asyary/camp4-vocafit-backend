const service = require('./trainer.service');
const { trainerSchema, scheduleSchema, imageSchema } = require('./trainer.validation');

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

const createSchedule = async (req, res, next) => {
    try {
        const parsedBody = scheduleSchema.parse(req.body);
        const schedule = await service.addSchedule(parsedBody);
        res.success(schedule, 'Schedule created successfully', 201);
    } catch (err) {
        next(err);
    }
};

module.exports = { createTrainer, getTrainers, createSchedule };