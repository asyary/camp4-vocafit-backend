const repository = require('./pengurus.repository');
const cloudinary = require('../../config/cloudinary');
const bcrypt = require('bcrypt');
const { withProfileImageThumb } = require('../../utils/image.util');

const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `vocafit/${folder}` },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        stream.end(fileBuffer);
    });
};

const getUsersList = async (page, limit) => {
    const offset = (page - 1) * limit;

    // Run both queries concurrently
    const [users, totalCount] = await Promise.all([
        repository.getAllUsers(limit, offset),
        repository.countAllUsers()
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
        page,
        limit,
        total_pages: totalPages,
        data: users.map(user => withProfileImageThumb(user))
    };
};

const getUserById = async (id) => {
    const user = await repository.getUserById(id);
    if (!user) throw new Error('User not found');
    return withProfileImageThumb(user);
};

const addUser = async (data, fileBuffer) => {
    if (!fileBuffer) throw new Error('User image is required');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const imageUrl = await uploadToCloudinary(fileBuffer, 'users');

    const newUser = await repository.createUser({
        ...data,
        passwordHash,
        profileImageUrl: imageUrl,
        penaltyAmount: data.penaltyAmount || 0
    });
    return withProfileImageThumb(newUser);
};

const editUser = async (id, data, fileBuffer) => {
    let passwordHash;
    if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 12);
    }

    let profileImageUrl;
    if (fileBuffer) {
        profileImageUrl = await uploadToCloudinary(fileBuffer, 'users');
    }

    const updatedUser = await repository.updateUser(id, {
        ...data,
        passwordHash,
        profileImageUrl
    });
    if (!updatedUser) throw new Error('User not found');
    return withProfileImageThumb(updatedUser);
};

const removeUser = async (id) => {
    const invalidatedUser = await repository.invalidateUser(id);
    if (!invalidatedUser) throw new Error('User not found');
    return invalidatedUser;
};

module.exports = {
    getUsersList, getUserById, addUser, editUser, removeUser
};