const { z } = require('zod');
const { paginationSchema } = require('../../utils/validation.util');

const newsSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters long"),
    content: z.string().min(10, "Content must be at least 10 characters long")
});

const trainerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    bio: z.string().optional()
});

const scheduleSchema = z.object({
    trainerId: z.uuid(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime()
});

// User Update Validation (Pengurus managing users)
const updateUserSchema = z.object({
    role: z.enum(['member', 'pengurus']).optional(),
    penaltyAmount: z.number().min(0, "Penalty amount must be a positive number").optional()
});

module.exports = { newsSchema, trainerSchema, scheduleSchema, updateUserSchema, paginationSchema };