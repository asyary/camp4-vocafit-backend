const service = require('./user.service');
const { updateProfileSchema } = require('./user.validation');
const { clearTokens } = require('../../utils/cookie.util');

const getMe = async (req, res) => {
    try {
        const user = await service.getMyProfile(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        next(err);
    }
};

const updateMe = async (req, res) => {
    try {
        const parsedBody = updateProfileSchema.parse(req.body);
        const updatedUser = await service.updateMyProfile(req.user.id, parsedBody);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        next(err);
    }
};

const deleteMe = async (req, res) => {
    try {
        await service.deleteMyAccount(req.user.id);
        clearTokens(res); // Log them out by clearing cookies
        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getMe, updateMe, deleteMe };