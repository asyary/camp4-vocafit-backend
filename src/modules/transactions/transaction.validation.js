const { z } = require('zod');

const createTransactionSchema = z.object({
    paymentMethod: z.enum(['QRIS', 'CASH']),
    transactionType: z.string().trim().min(1).regex(/^[A-Z0-9_]+$/, 'Transaction type must use uppercase letters, numbers, and underscores only')
});

const confirmCashSchema = z.object({
    transactionId: z.uuid(),
    status: z.enum(['SUCCESS', 'FAILED'])
});

module.exports = { createTransactionSchema, confirmCashSchema };