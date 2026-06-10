const service = require('./user.service');
const { updateProfileSchema, updatePasswordSchema } = require('./user.validation');
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
        res.success(null, 'Account invalidated successfully');
    } catch (err) {
        next(err);
    }
};

const updatePassword = async (req, res, next) => {
    try {
        const parsedBody = updatePasswordSchema.parse(req.body);
        await service.updateMyPassword(req.user.id, parsedBody.currentPassword, parsedBody.newPassword);
        res.success(null, 'Password updated successfully');
    } catch (err) {
        next(err);
    }
};

const getMySessions = async (req, res, next) => {
    try {
        const { verifyAccessToken } = require('../../utils/jwt.util');
        const token = req.cookies.access_token;
        let currentSessionId = null;
        if (token) {
            try {
                const decoded = verifyAccessToken(token);
                currentSessionId = decoded.sessionId;
            } catch (err) {}
        }

        const sessions = await service.getMySessions(req.user.id, currentSessionId);
        res.success(sessions, 'Sessions retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const revokeMySession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        await service.revokeMySession(req.user.id, sessionId);
        res.success(null, 'Session revoked successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = { getMe, updateMe, deleteMe, updatePassword, getMySessions, revokeMySession };