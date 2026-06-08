const { z } = require('zod');

const unitEnum = z.enum(['kg', 'm', 'km', 'l', 'sec', 'min', 'hr', 'reps', 'sets', 'cal', 'steps', 'other']);

const createActivitySchema = z.object({
    taskName: z.string().min(2, "Task name must be at least 2 characters long"),
    note: z.string().optional(),
    targetValue: z.number().min(0, "Target value must be a positive number"),
    unit: unitEnum
});

const updateActivitySchema = z.object({
    taskName: z.string().min(2, "Task name must be at least 2 characters long").optional(),
    isCompleted: z.boolean().optional(),
    note: z.string().optional(),
    currentValue: z.number().min(0).optional(),
    targetValue: z.number().min(0).optional(),
    unit: unitEnum.optional()
});

module.exports = { createActivitySchema, updateActivitySchema };