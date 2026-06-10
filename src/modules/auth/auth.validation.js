const { z } = require('zod');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    fullName: z.string().min(2, "Full name must be at least 2 characters long"),
    phoneNumber: z.string().regex(/^\+628[1-9][0-9]{6,10}$/, "Invalid phone number format").optional(),
    birthDate: z.coerce.date().min(new Date('1900-01-01'), "Date of birth cannot be earlier than 1900").max(new Date(), "Date of birth cannot be in the future").optional(),
	image: z
        .any()
        .refine((file) => !!file, 'Profile image is required')
        .refine((file) => !file || file.size <= MAX_FILE_SIZE, 'Max image size is 5MB.')
        .refine(
            (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.mimetype || file.type),
            'Only .jpg, .jpeg, .png and .webp formats are supported.'
        )
});

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters long")
});

const forgotPasswordSchema = z.object({
    email: z.email()
});

const resetPasswordSchema = z.object({
    email: z.email(),
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters long')
});

const verifyOtpSchema = z.object({
    email: z.email(),
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits')
});

const resendVerificationEmailSchema = z.object({
    email: z.string().email(),
});

const registerGoogleSchema = z.object({
    googleToken: z.string(),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    fullName: z.string().min(2, "Full name must be at least 2 characters long"),
    phoneNumber: z.string().regex(/^\+628[1-9][0-9]{6,10}$/, "Invalid phone number format"),
    birthDate: z.coerce.date().min(new Date('1900-01-01'), "Date of birth cannot be earlier than 1900").max(new Date(), "Date of birth cannot be in the future"),
	image: z
        .any()
        .optional()
        .refine((file) => !file || file.size <= MAX_FILE_SIZE, 'Max image size is 5MB.')
        .refine(
            (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.mimetype || file.type),
            'Only .jpg, .jpeg, .png and .webp formats are supported.'
        )
});

const loginGoogleSchema = z.object({
    googleToken: z.string()
});

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyOtpSchema, resendVerificationEmailSchema, registerGoogleSchema, loginGoogleSchema };