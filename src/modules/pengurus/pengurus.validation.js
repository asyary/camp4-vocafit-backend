const { z } = require('zod');
const { paginationSchema } = require('../../utils/validation.util');

const newsSchema = z.object({
    title: z.string().min(3),
    content: z.string().min(10)
});

const trainerSchema = z.object({
    name: z.string().min(2),
    bio: z.string().optional()
});

const scheduleSchema = z.object({
    trainerId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime()
});

// User Update Validation (Pengurus managing users)
const updateUserSchema = z.object({
    role: z.enum(['member', 'pengurus']).optional(),
    penaltyAmount: z.number().min(0).optional()
});

module.exports = { newsSchema, trainerSchema, scheduleSchema, updateUserSchema, paginationSchema };