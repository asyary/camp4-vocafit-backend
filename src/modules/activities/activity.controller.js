const service = require('./activity.service');
const { createActivitySchema, updateActivitySchema } = require('./activity.validation');
const { paginationSchema } = require('../../utils/validation.util');

const createActivity = async (req, res) => {
    try {
        const parsedBody = createActivitySchema.parse(req.body);
        const activity = await service.addActivity(req.user.id, parsedBody);
        res.success(activity, 'Activity created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getActivities = async (req, res) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await service.fetchActivities(req.user.id, page, limit);
        res.success(result.data, 'Activities retrieved successfully', 200, { page, limit, total: result.total_pages });
    } catch (err) {
        next(err);
    }
};

const updateActivity = async (req, res) => {
    try {
        const parsedBody = updateActivitySchema.parse(req.body);
        const updatedActivity = await service.modifyActivity(req.params.id, req.user.id, parsedBody);
        res.success(updatedActivity, 'Activity updated successfully');
    } catch (err) {
        next(err);
    }
};

const deleteActivity = async (req, res) => {
    try {
        await service.removeActivity(req.params.id, req.user.id);
        res.success(null, 'Activity deleted successfully');
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