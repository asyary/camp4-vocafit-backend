const service = require('./transaction.service');
const { createTransactionSchema, confirmCashSchema } = require('./transaction.validation');

const createTransaction = async (req, res, next) => {
    try {
        const parsedBody = createTransactionSchema.parse(req.body);
        const result = await service.createPayment(req.user.id, parsedBody);
        res.success(result, 'Transaction created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const getPendingCash = async (req, res, next) => {
    try {
        const transactions = await service.getCashPayments();
        res.success(transactions, 'Pending cash transactions retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const confirmCash = async (req, res, next) => {
    try {
        const { transactionId, status } = confirmCashSchema.parse(req.body);
        const transaction = await service.confirmCashPayment(transactionId, status);
        res.success(transaction, `Transaction marked as ${status}`);
    } catch (err) {
        next(err);
    }
};

const midtransWebhook = async (req, res, next) => {
    try {
        // Midtrans sends the notification via POST body
        const result = await service.handleMidtransWebhook(req.body);
        
        // Expects a 200 OK response, otherwise it will retry
        res.success(null, result.message);
    } catch (err) {
        console.error('Midtrans Webhook Error:', err.message);
        next(err);
    }
};

module.exports = { createTransaction, getPendingCash, confirmCash, midtransWebhook };