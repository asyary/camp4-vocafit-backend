const express = require('express');
const controller = require('./visit.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Members request a QR code to enter/exit
router.get('/qr', requireAuth, controller.getQrCode);

// Public or pengurus endpoint to process the scanned QR code
// (ini IoT-nya gimana yak, pake Postman dulu adja lach)
router.post('/scan', controller.scanQrCode);

// Public endpoint to check how many people are in the gym
router.get('/crowd', controller.getCrowd);

module.exports = router;