const { z } = require('zod');

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
    packageIdParamSchema,
    sessionIdParamSchema,
    bookSessionSchema,
    cancelSessionSchema,
};