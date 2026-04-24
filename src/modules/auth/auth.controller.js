const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.validation');
const { setTokens, clearTokens } = require('../../utils/cookie.util');

const register = async (req, res, next) => {
    try {
        const parsedBody = registerSchema.parse(req.body);
        const fileBuffer = req.file.buffer;

        await authService.register(parsedBody, fileBuffer);
        res.success(null, 'Registration successful. Please check your email to verify.', 201);
    } catch (err) {
        next(err);
    }
};

const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.params;
        if (!token) {
			const err = new Error('Token is required');
			err.status = 400;
			return next(err);
		};
        
        const verified = await authService.verifyUser(token);
        if (!verified) {
			const err = new Error('Invalid or expired token');
			err.status = 404;
			return next(err);
		};

        res.success(null, 'Email verified successfully. You can now login.');
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const parsedBody = loginSchema.parse(req.body);
        const { accessToken, refreshToken, user } = await authService.login(parsedBody);
        
        setTokens(res, accessToken, refreshToken);
        res.success(user, 'Login successful', 200);
    } catch (err) {
        next(err);
    }
};

const logout = (req, res) => {
    clearTokens(res);
    res.success(null, 'Logged out successfully');
};

module.exports = { register, verifyEmail, login, logout };