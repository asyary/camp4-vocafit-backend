const { z } = require('zod');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const trainerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().optional(),
    bio: z.string().optional(),
    specialties: z.string().optional(),
});

const updateTrainerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    email: z.string().email('Invalid email address').optional(),
    phoneNumber: z.string().optional(),
    bio: z.string().optional(),
    specialties: z.string().optional(),
});

const imageSchema = z.object({
    image: z
        .any()
        .refine((file) => !file || file.size <= MAX_FILE_SIZE, 'Max image size is 5MB.')
        .refine(
            (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.mimetype || file.type),
            'Only .jpg, .jpeg, .png and .webp formats are supported.'
        )
});

const trainerIdParamSchema = z.object({
    trainerId: z.uuid()
});

const packageIdParamSchema = z.object({
    packageId: z.uuid()
});

const sessionIdParamSchema = z.object({
    sessionId: z.uuid()
});

const bookSessionSchema = z.object({
    startTime: z.iso.datetime()
});

const cancelSessionSchema = z.object({
    reason: z.string().trim().max(500).optional()
});

module.exports = {
    trainerSchema,
    updateTrainerSchema,
    imageSchema,
    trainerIdParamSchema,
    packageIdParamSchema,
    sessionIdParamSchema,
    bookSessionSchema,
    cancelSessionSchema,
};