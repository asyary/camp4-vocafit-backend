const bcrypt = require('bcrypt');
const repository = require('./user.repository');
const { withProfileImageThumb } = require('../../utils/image.util');

const getMyProfile = async (userId) => {
    const user = await repository.getUserProfile(userId);
    if (!user) throw new Error('User not found');
    return withProfileImageThumb(user);
};

const updateMyProfile = async (userId, data) => {
    let passwordHash = undefined;
    if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 10);
    }
    
    const updatedUser = await repository.updateProfile(userId, { 
        fullName: data.fullName, 
        passwordHash 
    });
    return withProfileImageThumb(updatedUser);
};

const deleteMyAccount = async (userId) => {
    const invalidatedUser = await repository.invalidateAccount(userId);
    if (!invalidatedUser) throw new Error('User not found');
    return invalidatedUser; // invalidateAccount returns id, email, full_name, role. No profile_image_url
};

module.exports = { getMyProfile, updateMyProfile, deleteMyAccount };