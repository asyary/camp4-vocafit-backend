const { z } = require('zod');

const createActivitySchema = z.object({
    taskName: z.string().min(2, "Task name must be at least 2 characters long")
});

const updateActivitySchema = z.object({
    taskName: z.string().min(2, "Task name must be at least 2 characters long").optional(),
    isCompleted: z.boolean().optional()
});

module.exports = { createActivitySchema, updateActivitySchema };