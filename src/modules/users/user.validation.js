const { z } = require('zod');

const updateProfileSchema = z.object({
    fullName: z.string().min(2).optional(),
    password: z.string().min(6).optional()
});

module.exports = { updateProfileSchema };