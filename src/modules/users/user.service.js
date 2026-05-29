const bcrypt = require('bcrypt');
const repository = require('./user.repository');

const getMyProfile = async (userId) => {
    const user = await repository.getUserProfile(userId);
    if (!user) throw new Error('User not found');
    return user;
};

const updateMyProfile = async (userId, data) => {
    let passwordHash = undefined;
    if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 10);
    }
    
    return await repository.updateProfile(userId, { 
        fullName: data.fullName, 
        passwordHash 
    });
};

const deleteMyAccount = async (userId) => {
    const invalidatedUser = await repository.invalidateAccount(userId);
    if (!invalidatedUser) throw new Error('User not found');
    return invalidatedUser;
};

module.exports = { getMyProfile, updateMyProfile, deleteMyAccount };