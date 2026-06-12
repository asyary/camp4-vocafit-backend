const express = require('express');
const controller = require('./auth.controller');
const upload = require('../../middlewares/upload.middleware');
const { verifyTurnstile } = require('../../middlewares/turnstile.middleware');
const router = express.Router();

router.post('/login/google', controller.loginGoogle);
router.post('/register/google', upload.single('image'), controller.registerGoogle);
router.post('/logout', controller.logout);

// All auth routes are protected by Turnstile (managed)
router.use(verifyTurnstile);

router.post('/register', upload.single('image'), controller.register);
router.post('/register/resend', controller.resendVerificationEmail);
router.get('/verify-email/:token', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/forgot-password/resend', controller.resendForgotPasswordOtp);
router.post('/forgot-password/otp', controller.verifyOtp);
router.post('/forgot-password/reset', controller.resetPassword);

module.exports = router;