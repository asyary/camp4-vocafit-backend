const cloudinary = require('../config/cloudinary');

const withTimeout = (promise, timeoutMs, message) => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const uploadToCloudinary = (fileBuffer, folder) => {
    const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `vocafit/${folder}` },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        stream.end(fileBuffer);
    });

    return withTimeout(uploadPromise, 15000, 'Cloudinary upload timed out');
};

module.exports = { uploadToCloudinary };
