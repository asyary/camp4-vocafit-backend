const express = require('express');
const controller = require('./transaction.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.post('/create', requireAuth, controller.createTransaction);

// Cash handling
router.get('/cash/pending', requireAuth, requireRole('pengurus'), controller.getPendingCash);
router.post('/cash/confirm', requireAuth, requireRole('pengurus'), controller.confirmCash);

// Midtrans Webhook (public)
router.post('/webhook', controller.midtransWebhook);

module.exports = router;