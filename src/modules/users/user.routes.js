const express = require('express');
const controller = require('./user.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);
router.delete('/me', controller.deleteMe);

module.exports = router;