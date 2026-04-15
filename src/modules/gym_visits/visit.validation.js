const { z } = require('zod');

const scanQrSchema = z.object({
    qrToken: z.string().min(1, "QR Token is required")
});

module.exports = { scanQrSchema };