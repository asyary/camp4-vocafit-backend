const { z } = require('zod');

const scanQrSchema = z.object({
    qr: z.string("QR Token is required").min(1, "QR Token is required")
});

module.exports = { scanQrSchema };