const { z } = require('zod');

const updateProfileSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters long").optional(),
    password: z.string().min(6, "Password must be at least 6 characters long").optional()
});

module.exports = { updateProfileSchema };