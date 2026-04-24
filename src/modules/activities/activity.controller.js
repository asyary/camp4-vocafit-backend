const service = require('./activity.service');
const { createActivitySchema, updateActivitySchema } = require('./activity.validation');
const { paginationSchema } = require('../../utils/validation.util');

const createActivity = async (req, res) => {
    try {
        const parsedBody = createActivitySchema.parse(req.body);
        const activity = await service.addActivity(req.user.id, parsedBody);
        res.status(201).json({ success: true, data: activity });
    } catch (err) {
        next(err);
    }
};

const getActivities = async (req, res) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.fetchActivities(req.user.id, page, limit);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};

const updateActivity = async (req, res) => {
    try {
        const parsedBody = updateActivitySchema.parse(req.body);
        const updatedActivity = await service.modifyActivity(req.params.id, req.user.id, parsedBody);
        res.status(200).json({ success: true, data: updatedActivity });
    } catch (err) {
        next(err);
    }
};

const deleteActivity = async (req, res) => {
    try {
        await service.removeActivity(req.params.id, req.user.id);
        res.status(200).json({ success: true, message: 'Activity deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createActivity,
    getActivities,
    updateActivity,
    deleteActivity
};