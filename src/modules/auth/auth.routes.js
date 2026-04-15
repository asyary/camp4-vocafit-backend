const express = require('express');
const controller = require('./auth.controller');
const upload = require('../../middlewares/upload.middleware');
const router = express.Router();

router.post('/register', upload.single('image'), controller.register);
router.get('/verify-email', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/logout', controller.logout);

module.exports = router;