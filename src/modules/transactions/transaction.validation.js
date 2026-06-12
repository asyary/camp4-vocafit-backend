const { z } = require('zod');
const { paginationSchema } = require('../../utils/validation.util');

const participantEmailSchema = z.string().trim().email('Invalid participant email').transform((value) => value.toLowerCase());

const createTransactionSchema = z.object({
    paymentMethod: z.enum(['QRIS', 'CASH']),
    transactionType: z.string().trim().min(1).regex(/^[A-Z0-9_]+$/, 'Transaction type must use uppercase letters, numbers, and underscores only'),
    trainerId: z.uuid().optional(),
    participantEmails: z.array(participantEmailSchema).optional()
});

const confirmCashSchema = z.object({
    transactionId: z.uuid(),
    status: z.enum(['SUCCESS', 'FAILED'])
});

const cancelTransactionSchema = z.object({
    transactionId: z.uuid()
});

const transactionIdParamSchema = z.object({
    transactionId: z.uuid()
});

const transactionHistoryQuerySchema = paginationSchema.extend({
    method: z.enum(['qris', 'cash']).transform(v => v.toUpperCase()).optional(),
    status: z.enum(['success', 'failed', 'pending']).transform(v => v.toUpperCase()).optional(),
});

module.exports = { createTransactionSchema, confirmCashSchema, cancelTransactionSchema, transactionIdParamSchema, transactionHistoryQuerySchema };