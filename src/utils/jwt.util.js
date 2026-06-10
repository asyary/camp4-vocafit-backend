const jwt = require('jsonwebtoken');

const generateAccessToken = (userId, role, sessionId) => {
    return jwt.sign({ id: userId, role, sessionId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '3h' });
};

const generateRefreshToken = (userId, sessionId) => {
    return jwt.sign({ id: userId, sessionId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};