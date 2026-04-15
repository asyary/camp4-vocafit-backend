const service = require('./user.service');
const { updateProfileSchema } = require('./user.validation');
const { clearTokens } = require('../../utils/cookie.util');

const getMe = async (req, res) => {
    try {
        const user = await service.getMyProfile(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(404).json({ success: false, error: err.message });
    }
};

const updateMe = async (req, res) => {
    try {
        const parsedBody = updateProfileSchema.parse(req.body);
        const updatedUser = await service.updateMyProfile(req.user.id, parsedBody);
        res.status(200).json({ success: true, data: updatedUser });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const deleteMe = async (req, res) => {
    try {
        await service.deleteMyAccount(req.user.id);
        clearTokens(res); // Log them out by clearing cookies
        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = { getMe, updateMe, deleteMe };