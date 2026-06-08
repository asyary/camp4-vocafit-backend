const express = require('express');
const controller = require('./visit.controller');
const { requireAuth, requireRole, requireMembership } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Public or pengurus endpoint to process the scanned QR code
// (ini IoT-nya gimana yak, pake Postman dulu adja lach)
router.post('/scan', controller.scanQrCode);

router.use(requireAuth);

router.get('/crowd', controller.getCrowd);

router.use(requireRole('member'));

router.get('/history', controller.getMyVisitHistory);
router.get('/status', controller.getMyVisitStatus);

router.use(requireMembership);

router.get('/qr', controller.getQrCode);

module.exports = router;