const { z } = require('zod');

const createTransactionSchema = z.object({
    paymentMethod: z.enum(['QRIS', 'CASH']),
    transactionType: z.enum([
        'MEMBERSHIP_DAILY', 
        'MEMBERSHIP_MONTHLY', 
        'PT_SESSION', 
        'GROUP_FITNESS_3', 
        'GROUP_FITNESS_4', 
        'GROUP_FITNESS_5'
    ])
});

const confirmCashSchema = z.object({
    transactionId: z.string().uuid(),
    status: z.enum(['SUCCESS', 'FAILED'])
});

module.exports = { createTransactionSchema, confirmCashSchema };