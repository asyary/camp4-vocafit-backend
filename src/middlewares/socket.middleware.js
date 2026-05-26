const cookie = require('cookie');
const { verifyAccessToken } = require('../utils/jwt.util');

const requireSocketAuth = (socket, next) => {
    try {
        const cookieHeader = socket.handshake.headers.cookie || '';
        const cookies = cookie.parse(cookieHeader);
        const token = cookies.access_token;

        if (!token) {
            return next(new Error('No token provided'));
        }

        const decoded = verifyAccessToken(token);
        socket.user = decoded; 
        next();
    } catch (err) {
        return next(new Error('Invalid or expired token'));
    }
};

const requireSocketRole = (role) => (socket, next) => {
    if (!socket.user || socket.user.role !== role) {
        return next(new Error(`Privileges for ${role} required`));
    }
    next();
};

module.exports = { requireSocketAuth, requireSocketRole };