const { z } = require('zod');

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const newsSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters long'),
    content: z.string().min(10, 'Content must be at least 10 characters long')
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

module.exports = { newsSchema, imageSchema };