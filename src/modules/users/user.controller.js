const service = require('./user.service');
const { updateProfileSchema } = require('./user.validation');
const { clearTokens } = require('../../utils/cookie.util');

const getMe = async (req, res, next) => {
    try {
        const user = await service.getMyProfile(req.user.id);
        res.success(user, 'Profile retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const updateMe = async (req, res, next) => {
    try {
        const parsedBody = updateProfileSchema.parse(req.body);
        const updatedUser = await service.updateMyProfile(req.user.id, parsedBody);
        res.success(updatedUser, 'Profile updated successfully');
    } catch (err) {
        next(err);
    }
};

const deleteMe = async (req, res, next) => {
    try {
        await service.deleteMyAccount(req.user.id);
        clearTokens(res); // Log them out by clearing cookies
        res.success(null, 'Account deleted successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = { getMe, updateMe, deleteMe };