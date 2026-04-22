const { verifyAccessToken } = require('../utils/jwt.util');
const db = require('../config/db');

const requireAuth = (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

const requireRole = (role) => (req, res, next) => {
    if (req.user.role !== role) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
};

const requireMembership = async (req, res, next) => {
    if (!req.user || !req.user.role || req.user.role !== 'member') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const result = await db.query(
            'SELECT 1 FROM memberships WHERE user_id = $1 AND end_date > NOW()',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ message: 'Active membership required' });
        }

        next();
    } catch (err) {
        console.error('Membership check error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { requireAuth, requireRole, requireMembership };