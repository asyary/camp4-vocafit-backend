const express = require('express');
const controller = require('./auth.controller');
const upload = require('../../middlewares/upload.middleware');
const router = express.Router();

// These routes needs captcha
router.post('/register', upload.single('image'), controller.register);
router.post('/register/google', upload.single('image'), controller.registerGoogle);
router.post('/register/resend', controller.resendVerificationEmail);
router.get('/verify-email/:token', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/login/google', controller.loginGoogle);
router.post('/logout', controller.logout);
router.post('/forgot-password', controller.forgotPassword);
router.post('/forgot-password/resend', controller.resendForgotPasswordOtp);
router.post('/forgot-password/reset', controller.resetPassword);

module.exports = router;