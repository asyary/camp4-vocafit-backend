const bcrypt = require('bcrypt');
const repository = require('./user.repository');
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
};

module.exports = { getMyProfile, updateMyProfile, deleteMyAccount, updateMyPassword };