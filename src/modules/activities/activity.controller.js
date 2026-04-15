const service = require('./activity.service');
const { createActivitySchema, updateActivitySchema } = require('./activity.validation');
const { paginationSchema } = require('../../utils/validation.util');

const createActivity = async (req, res) => {
    try {
        const parsedBody = createActivitySchema.parse(req.body);
        const activity = await service.addActivity(req.user.id, parsedBody);
        res.status(201).json({ success: true, data: activity });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const getActivities = async (req, res) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.fetchActivities(req.user.id, page, limit);
        res.status(200).json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.errors || err.message });
    }
};

const updateActivity = async (req, res) => {
    try {
        const parsedBody = updateActivitySchema.parse(req.body);
        const updatedActivity = await service.modifyActivity(req.params.id, req.user.id, parsedBody);
        res.status(200).json({ success: true, data: updatedActivity });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const deleteActivity = async (req, res) => {
    try {
        await service.removeActivity(req.params.id, req.user.id);
        res.status(200).json({ success: true, message: 'Activity deleted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

module.exports = {
    createActivity,
    getActivities,
    updateActivity,
    deleteActivity
};