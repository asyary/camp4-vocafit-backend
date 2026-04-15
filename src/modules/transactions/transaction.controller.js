const service = require('./transaction.service');
const { createTransactionSchema, confirmCashSchema } = require('./transaction.validation');

const createTransaction = async (req, res) => {
    try {
        const parsedBody = createTransactionSchema.parse(req.body);
        const result = await service.createPayment(req.user.id, parsedBody);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const getPendingCash = async (req, res) => {
    try {
        const transactions = await service.getCashPayments();
        res.status(200).json({ success: true, data: transactions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const confirmCash = async (req, res) => {
    try {
        const { transactionId, status } = confirmCashSchema.parse(req.body);
        const transaction = await service.confirmCashPayment(transactionId, status);
        res.status(200).json({ success: true, message: `Transaction marked as ${status}`, data: transaction });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
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
        // Return 500 to retry if it was a server error, 
        // or 400 if it was a bad signature
        const statusCode = err.message.includes('signature') ? 400 : 500;
        res.status(statusCode).json({ success: false, error: err.message });
    }
};

module.exports = { createTransaction, getPendingCash, confirmCash, midtransWebhook };