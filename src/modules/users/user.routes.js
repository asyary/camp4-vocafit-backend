const express = require('express');
const controller = require('./user.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);
router.put('/me/password', controller.updatePassword);
router.delete('/me', controller.deleteMe);
// router.get('/me/activities', controller.getMyActivities);
// router.get('/me/transactions', controller.getMyTransactions);
// router.get('/me/visits', controller.getMyVisits);
// router.get('/me/membership', controller.getMyMembership);
// router.get('/me/trainers', controller.getMyTrainers);

module.exports = router;