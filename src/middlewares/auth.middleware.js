const { verifyAccessToken } = require('../utils/jwt.util');
const db = require('../config/db');

const requireAuth = (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) {
        const err = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        const err = new Error('Invalid or expired token');
        err.status = 401;
        return next(err);
    }
};

const requireRole = (role) => (req, res, next) => {
    if (req.user.role !== role) {
        const err = new Error('Forbidden');
        err.status = 403;
        return next(err);
    }
    next();
};

const requireMembership = async (req, res, next) => {
    if (!req.user || !req.user.role || req.user.role !== 'member') {
        const err = new Error('Forbidden');
        err.status = 403;
        return next(err);
    }

    try {
        const result = await db.query(
            'SELECT 1 FROM memberships WHERE user_id = $1 AND end_date > NOW()',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            const err = new Error('Active membership required');
            err.status = 403;
            return next(err);
        }

        next();
    } catch (err) {
        console.error('Membership check error:', err);
        const error = new Error('Internal server error');
        error.status = 500;
        return next(error);
    }
};

module.exports = { requireAuth, requireRole, requireMembership };