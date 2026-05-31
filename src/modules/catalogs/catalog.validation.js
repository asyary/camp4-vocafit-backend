const { z } = require('zod');

const toBoolean = (value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
};

const baseCatalogSchema = {
    code: z.string().min(2, 'Code must be at least 2 characters long'),
    family: z.enum(['MEMBERSHIP', 'PERSONAL_TRAINER']),
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    description: z.string().nullable().optional(),
    groupSize: z.coerce.number().int().positive().nullable().optional(),
    sessionCount: z.coerce.number().int().positive().nullable().optional(),
    durationDays: z.coerce.number().int().positive().nullable().optional(),
    isActive: z.preprocess(toBoolean, z.boolean().default(true))
};

const createCatalogSchema = z.object(baseCatalogSchema);

const updateCatalogSchema = z.object({
    family: baseCatalogSchema.family.optional(),
    name: baseCatalogSchema.name.optional(),
    description: baseCatalogSchema.description,
    groupSize: baseCatalogSchema.groupSize,
    sessionCount: baseCatalogSchema.sessionCount,
    durationDays: baseCatalogSchema.durationDays,
    isActive: z.preprocess(toBoolean, z.boolean().optional())
});

const reorderCatalogSchema = z.object({
    family: baseCatalogSchema.family,
    orderedCodes: z.array(z.string().min(2, 'Code must be at least 2 characters long')).min(1, 'At least one catalog code is required')
        .refine((codes) => new Set(codes).size === codes.length, 'Catalog codes must be unique')
});

module.exports = { createCatalogSchema, updateCatalogSchema, reorderCatalogSchema };