const express = require('express');
const controller = require('./transaction.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const { verifyTurnstile } = require('../../middlewares/turnstile.middleware');

const router = express.Router();

// Midtrans Webhook (public)
router.post('/webhook', controller.midtransWebhook);

router.use(requireAuth);

router.post('/create', verifyTurnstile, controller.createTransaction);

router.post('/:transactionId/cancel', controller.cancelTransaction);
router.get('/history', controller.getTransactionHistory);
router.get('/:transactionId', controller.getTransactionDetails);

router.use(requireRole('pengurus'));

router.post('/confirm', controller.confirmCash);

module.exports = router;