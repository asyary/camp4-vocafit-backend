const express = require('express');
const controller = require('./visit.controller');
const { requireAuth, requireRole, requireMembership } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Public or pengurus endpoint to process the scanned QR code
// (ini IoT-nya gimana yak, pake Postman dulu adja lach)
router.post('/scan', controller.scanQrCode);

router.use(requireAuth);

// Members request a QR code to enter/exit
router.get('/qr', requireRole('member'), requireMembership, controller.getQrCode);

// Public endpoint to check how many people are in the gym
router.get('/crowd', controller.getCrowd);

module.exports = router;