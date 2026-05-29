const { z } = require('zod');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const trainerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    bio: z.string().optional(),
    image: z
        .any()
        .refine((file) => !file || file.size <= MAX_FILE_SIZE, 'Max image size is 5MB.')
        .refine(
            (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.mimetype || file.type),
            'Only .jpg, .jpeg, .png and .webp formats are supported.'
        )
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

const scheduleSchema = z.object({
    trainerId: z.uuid(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime()
});

module.exports = { trainerSchema, scheduleSchema, imageSchema };