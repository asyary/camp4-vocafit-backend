const express = require('express');
const controller = require('./trainer.controller');
const { requireAuth, requireRole, requireMembership } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

// Public
router.get('/', controller.getTrainers);

router.use(requireAuth);

// Member trainer package flow
router.get('/packages', requireMembership, controller.getMyPackages);
router.get('/packages/:packageId', requireMembership, controller.getPackageDetails);
router.post('/packages/:packageId/sessions', requireMembership, controller.bookSession);
router.post('/sessions/:sessionId/cancel', controller.cancelSession);

// Admin session views
router.get('/admin/sessions', requireRole('pengurus'), controller.getAllSessions);
router.get('/admin/sessions/:trainerId', requireRole('pengurus'), controller.getSessionsByTrainerId);

// Admin trainer CRUD
router.get('/:trainerId', controller.getTrainerById);
router.post('/', requireRole('pengurus'), upload.single('image'), controller.createTrainer);
router.put('/:trainerId', requireRole('pengurus'), upload.single('image'), controller.updateTrainer);
router.delete('/:trainerId', requireRole('pengurus'), controller.deactivateTrainer);

module.exports = router;