const repository = require('./activity.repository');

const addActivity = async (userId, data) => {
    return await repository.createActivity(userId, data.taskName);
};

const fetchActivities = async (userId, page, limit) => {
    const offset = (page - 1) * limit;

    const [activities, totalCount] = await Promise.all([
        repository.getUserActivities(userId, limit, offset),
        repository.countUserActivities(userId)
    ]);

    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        data: activities
    };
};

const modifyActivity = async (id, userId, data) => {
    // Check if it exists and belongs to the user
    const existing = await repository.getActivityByIdAndUser(id, userId);
    if (!existing) {
        throw new Error('Activity not found or unauthorized');
    }

    return await repository.updateActivity(id, userId, data);
};

const removeActivity = async (id, userId) => {
    const deletedCount = await repository.deleteActivity(id, userId);
    if (deletedCount === 0) {
        throw new Error('Activity not found or unauthorized');
    }
    return true;
};

module.exports = {
    addActivity,
    fetchActivities,
    modifyActivity,
    removeActivity
};