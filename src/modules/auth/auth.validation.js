const { z } = require('zod');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    fullName: z.string().min(2, "Full name must be at least 2 characters long"),
	image: z
    .any()
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max image size is 5MB.`)
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    )
});

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters long")
});

module.exports = { registerSchema, loginSchema };