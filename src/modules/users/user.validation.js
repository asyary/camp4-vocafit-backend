const { z } = require('zod');

const updatePasswordSchema = z.object({
    currentPassword: z.string().min(6, "Current password must be at least 6 characters long"),
    newPassword: z.string().min(6, "New password must be at least 6 characters long")
});

module.exports = { updatePasswordSchema };