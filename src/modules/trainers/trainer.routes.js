const express = require('express');
const controller = require('./trainer.controller');
const { requireAuth, requireRole, requireMembership } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

// Public
router.get('/', controller.getTrainers);

// Member trainer package flow
router.get('/packages', requireAuth, requireMembership, controller.getMyPackages);
router.get('/packages/:packageId', requireAuth, requireMembership, controller.getPackageDetails);
router.post('/packages/:packageId/sessions', requireAuth, requireMembership, controller.bookSession);
router.post('/sessions/:sessionId/cancel', requireAuth, controller.cancelSession);

// Admin trainer CRUD
router.get('/:trainerId', controller.getTrainerById);
router.post('/', requireAuth, requireRole('pengurus'), upload.single('image'), controller.createTrainer);
router.put('/:trainerId', requireAuth, requireRole('pengurus'), upload.single('image'), controller.updateTrainer);
router.delete('/:trainerId', requireAuth, requireRole('pengurus'), controller.deactivateTrainer);

module.exports = router;