const express = require('express');
const controller = require('./trainer.controller');
const packageController = require('./trainer.package.controller');
const { requireAuth, requireRole, requireMembership } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

// Public
router.get('/', controller.getTrainers);

router.use(requireAuth);

// Member trainer package flow
router.get('/packages', requireMembership, packageController.getMyPackages);
router.get('/packages/:packageId', requireMembership, packageController.getPackageDetails);
router.post('/packages/:packageId/sessions', requireMembership, packageController.bookSession);
router.post('/sessions/:sessionId/cancel', packageController.cancelSession);

// Admin
router.post('/', requireRole('pengurus'), upload.single('image'), controller.createTrainer);
router.post('/schedule', requireRole('pengurus'), controller.createSchedule);

module.exports = router;