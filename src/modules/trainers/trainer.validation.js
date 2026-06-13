const { z } = require('zod');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const phoneRegex = /^\+628[1-9][0-9]{6,9}$/;

const trainerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().regex(phoneRegex, 'Invalid phone number format'),
    bio: z.string("Bio must be a string").min(10, 'Bio must be at least 10 characters long').max(200, 'Bio must be at most 200 characters long'),
    specialties: z.string("Specialties must be a string").min(5, 'Specialties must be at least 5 characters long').max(100, 'Specialties must be at most 100 characters long'),
});

const updateTrainerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    email: z.string().email('Invalid email address').optional(),
    phoneNumber: z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
    bio: z.string("Bio must be a string").min(10, 'Bio must be at least 10 characters long').max(200, 'Bio must be at most 200 characters long').optional(),
    specialties: z.string("Specialties must be a string").min(5, 'Specialties must be at least 5 characters long').max(100, 'Specialties must be at most 100 characters long').optional(),
});

const imageSchema = z.object({
    image: z
        .any()
        .refine((file) => !!file, 'Trainer image is required')
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

const sessionQuerySchema = z.object({
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
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
    sessionQuerySchema,
};