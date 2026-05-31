const { z } = require('zod');
const { paginationSchema } = require('../../utils/validation.util');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const createUserSchema = z.object({
	email: z.string().email('Invalid email format'),
	fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
	password: z.string().min(8, 'Password must be at least 8 characters long'),
	role: z.enum(['member', 'pengurus']).default('member'),
	membershipPriceCode: z.string().optional(),
	penaltyAmount: z.coerce.number().min(0, 'Penalty amount must be a positive number').optional()
});

const imageSchema = z.object({
	image: z
	.any()
	.refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max image size is 5MB.`)
	.refine(
		(file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.mimetype || file.type),
		"Only .jpg, .jpeg, .png and .webp formats are supported."
	)
})

const updateUserSchema = z.object({
	email: z.string().email('Invalid email format').optional(),
	fullName: z.string().min(2, 'Full name must be at least 2 characters long').optional(),
	password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
    role: z.enum(['member', 'pengurus']).optional(),
	membershipPriceCode: z.string().nullable().optional(),
	penaltyAmount: z.coerce.number().min(0, 'Penalty amount must be a positive number').optional()
});

module.exports = { createUserSchema, updateUserSchema, imageSchema, paginationSchema };