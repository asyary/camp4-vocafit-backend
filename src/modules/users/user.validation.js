const { z } = require('zod');

const updateProfileSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters long").optional(),
	phoneNumber: z.string().regex(/^\+628[1-9][0-9]{6,10}$/, "Invalid phone number format").optional()
});

const updatePasswordSchema = z.object({
    currentPassword: z.string().min(6, "Current password must be at least 6 characters long"),
    newPassword: z.string().min(6, "New password must be at least 6 characters long")
});

module.exports = { updateProfileSchema, updatePasswordSchema };