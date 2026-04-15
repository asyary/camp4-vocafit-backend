const express = require('express');
const controller = require('./pengurus.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

// Public
router.get('/', controller.getTrainers);

// Admin
router.use(requireAuth);
router.use(requireRole('pengurus'));

router.post('/', upload.single('image'), controller.createTrainer);
router.post('/schedule', controller.createSchedule);

module.exports = router;