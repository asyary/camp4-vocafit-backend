const authService = require('./auth.service');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, resendVerificationEmailSchema } = require('./auth.validation');
const { setTokens, clearTokens } = require('../../utils/cookie.util');

const register = async (req, res, next) => {
    try {
        const parsedBody = registerSchema.parse({ ...req.body, image: req.file });

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
        
        const result = await authService.verifyUser(token);
        if (!result) {
			const err = new Error('Invalid or expired token');
			err.status = 404;
			return next(err);
		};

        setTokens(res, result.accessToken, result.refreshToken);
        res.success(result.user, 'Email verified and logged in successfully.');
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

const logout = (req, res, next) => {
    clearTokens(res);
    res.success(null, 'Logged out successfully');
};

const forgotPassword = async (req, res, next) => {
    try {
        const parsedBody = forgotPasswordSchema.parse(req.body);
        await authService.requestPasswordReset(parsedBody.email);
        res.success(null, 'If the account exists, an OTP has been sent to the registered email.');
    } catch (err) {
        next(err);
    }
};

const resendForgotPasswordOtp = async (req, res, next) => {
    try {
        const parsedBody = forgotPasswordSchema.parse(req.body);
        await authService.resendPasswordResetOtp(parsedBody.email);
        res.success(null, 'OTP resent successfully.');
    } catch (err) {
        next(err);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const parsedBody = resetPasswordSchema.parse(req.body);
        await authService.resetPassword(parsedBody.email, parsedBody.otp, parsedBody.newPassword);
        res.success(null, 'Password reset successfully.');
    } catch (err) {
        next(err);
    }
};

const resendVerificationEmail = async (req, res, next) => {
    try {
        const parsedBody = resendVerificationEmailSchema.parse(req.body);
        await authService.resendVerificationEmail(parsedBody.email);
        res.success(null, 'If the account is registered, a verification email has been sent.');
    } catch (err) {
        next(err);
    }
};

module.exports = { register, verifyEmail, login, logout, forgotPassword, resendForgotPasswordOtp, resetPassword, resendVerificationEmail };