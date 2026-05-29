const express = require('express');
const controller = require('./transaction.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Midtrans Webhook (public)
router.post('/webhook', controller.midtransWebhook);

router.use(requireAuth);

router.post('/create', controller.createTransaction);
// TODO
// router.post('/cancel', controller.cancelTransaction);
// router.get('/history', controller.getTransactionHistory);
// router.get('/(:transactionId)', controller.getTransactionDetails);

router.use(requireRole('pengurus'));

// Cash handling
//router.get('/transactions', controller.getAllTransactions);
router.get('/cash/pending', controller.getPendingCash);
router.post('/cash/confirm', controller.confirmCash);

module.exports = router;