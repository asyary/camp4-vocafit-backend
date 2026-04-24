const service = require('./transaction.service');
const { createTransactionSchema, confirmCashSchema } = require('./transaction.validation');

const createTransaction = async (req, res) => {
    try {
        const parsedBody = createTransactionSchema.parse(req.body);
        const result = await service.createPayment(req.user.id, parsedBody);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const getPendingCash = async (req, res) => {
    try {
        const transactions = await service.getCashPayments();
        res.status(200).json({ success: true, data: transactions });
    } catch (err) {
        next(err);
    }
};

const confirmCash = async (req, res) => {
    try {
        const { transactionId, status } = confirmCashSchema.parse(req.body);
        const transaction = await service.confirmCashPayment(transactionId, status);
        res.status(200).json({ success: true, message: `Transaction marked as ${status}`, data: transaction });
    } catch (err) {
        next(err);
    }
};

const midtransWebhook = async (req, res) => {
    try {
        // Midtrans sends the notification via POST body
        const result = await service.handleMidtransWebhook(req.body);
        
        // Expects a 200 OK response, otherwise it will retry
        res.status(200).json({ success: true, message: result.message });
    } catch (err) {
        console.error('Midtrans Webhook Error:', err.message);
        next(err);
    }
};

module.exports = { createTransaction, getPendingCash, confirmCash, midtransWebhook };