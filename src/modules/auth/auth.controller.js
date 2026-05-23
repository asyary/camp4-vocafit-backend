const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.validation');
const { setTokens, clearTokens } = require('../../utils/cookie.util');

const wantsHtmlResponse = (req) => {
    const accept = req.headers.accept || '';
    return accept.includes('text/html');
};

const redirectToFrontendVerifyResult = (res, status, message) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const target = `${clientUrl}/verify-email/result?status=${encodeURIComponent(status)}&message=${encodeURIComponent(message)}`;
    return res.redirect(target);
};

const register = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Profile image is required for registration' });
        }
        
        const parsedBody = registerSchema.parse(req.body);
        const fileBuffer = req.file.buffer;

        await authService.register(parsedBody, fileBuffer);
        res.status(201).json({ message: 'Registration successful. Please check your email to verify.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.params;
        if (!token) {
            if (wantsHtmlResponse(req)) {
                return redirectToFrontendVerifyResult(res, 'error', 'Token required');
            }
            return res.status(400).json({ error: 'Token required' });
        }
        
        const verified = await authService.verifyUser(token);
        if (!verified) {
            if (wantsHtmlResponse(req)) {
                return redirectToFrontendVerifyResult(res, 'error', 'Invalid or expired token');
            }
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const successMessage = 'Email verified successfully. You can now login.';
        if (wantsHtmlResponse(req)) {
            return redirectToFrontendVerifyResult(res, 'success', successMessage);
        }

        res.status(200).json({ message: successMessage });
    } catch (err) {
        if (wantsHtmlResponse(req)) {
            return redirectToFrontendVerifyResult(res, 'error', err.message);
        }
        res.status(400).json({ error: err.message });
    }
};

const login = async (req, res, next) => {
    try {
        const parsedBody = loginSchema.parse(req.body);
        const { accessToken, refreshToken, user } = await authService.login(parsedBody);
        
        setTokens(res, accessToken, refreshToken);
        res.status(200).json({ message: 'Login successful', user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const logout = (req, res) => {
    clearTokens(res);
    res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = { register, verifyEmail, login, logout };
