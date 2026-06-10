const bcrypt = require('bcrypt');
const repository = require('./user.repository');
const authRepository = require('../auth/auth.repository');
const { withProfileImageThumb } = require('../../utils/image.util');

const getMyProfile = async (userId) => {
    const user = await repository.getUserProfile(userId);
    if (!user) throw new Error('User not found');
    return withProfileImageThumb(user);
};

const updateMyProfile = async (userId, data) => {
    const updatedUser = await repository.updateProfile(userId, { 
        fullName: data.fullName, 
        phoneNumber: data.phoneNumber 
    });
    return withProfileImageThumb(updatedUser);
};

const deleteMyAccount = async (userId) => {
    const invalidatedUser = await repository.invalidateAccount(userId);
    if (!invalidatedUser) throw new Error('User not found');
    return invalidatedUser; // invalidateAccount returns id, email, full_name, role. No profile_image_url
};

const updateMyPassword = async (userId, currentPassword, newPassword) => {
    const userPasswordHash = await repository.getUserPassword(userId);
    if (!userPasswordHash) throw new Error('User not found');
    
    const isMatch = await bcrypt.compare(currentPassword, userPasswordHash);
    if (!isMatch) {
        throw new Error('Incorrect current password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await repository.updatePassword(userId, newPasswordHash);
    await authRepository.invalidateAllUserSessions(userId);
};

const getMySessions = async (userId, currentSessionId) => {
    const sessions = await repository.getActiveSessions(userId);
    return sessions.map(session => ({
        id: session.id,
        ip_address: session.ip_address,
        is_current: session.id === currentSessionId,
        city: session.city,
        country: session.country,
        device_type: session.device_type,
        user_agent: session.user_agent,
        created_at: session.created_at,
        last_active_at: session.last_active_at
    }));
};

const revokeMySession = async (userId, sessionId) => {
    const session = await repository.revokeSession(userId, sessionId);
    if (!session) throw new Error('Session not found or already inactive');
    return session;
};

module.exports = { getMyProfile, updateMyProfile, deleteMyAccount, updateMyPassword, getMySessions, revokeMySession };