const { z } = require('zod');
const { paginationSchema } = require('../../utils/validation.util');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const newsSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters long"),
    content: z.string().min(10, "Content must be at least 10 characters long")
});

const trainerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    bio: z.string().optional(),
	image: z
	.any()
	.refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max image size is 5MB.`)
	.refine(
		(file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.mimetype || file.type),
		"Only .jpg, .jpeg, .png and .webp formats are supported."
	)
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

const scheduleSchema = z.object({
    trainerId: z.uuid(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime()
});

// User Update Validation (Pengurus managing users)
const updateUserSchema = z.object({
    role: z.enum(['member', 'pengurus']).optional(),
    penaltyAmount: z.number().min(0, "Penalty amount must be a positive number").optional()
});

module.exports = { newsSchema, trainerSchema, imageSchema, scheduleSchema, updateUserSchema, paginationSchema };