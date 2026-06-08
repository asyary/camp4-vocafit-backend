const { z } = require('zod');

const broadcastSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title must be at most 255 characters'),
    message: z.string().min(1, 'Message is required'),
    audience: z.enum(['ALL', 'ACTIVE_MEMBERS', 'INACTIVE_MEMBERS'], {
        errorMap: () => ({ message: 'Audience must be one of: ALL, ACTIVE_MEMBERS, INACTIVE_MEMBERS' })
    })
});

module.exports = { broadcastSchema };
