const service = require('./visit.service');
const { scanQrSchema } = require('./visit.validation');

const getQrCode = async (req, res) => {
    try {
        const qrToken = await service.generateQrToken(req.user.id);
        res.status(200).json({ success: true, data: { qrToken, expiresIn: '5 minutes' } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const scanQrCode = async (req, res) => {
    try {
        const { qrToken } = scanQrSchema.parse(req.body);
        const result = await service.processScan(qrToken);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

const getCrowd = async (req, res) => {
    try {
        const crowd = await service.getCrowdMeter();
        res.status(200).json({ success: true, data: crowd });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = { getQrCode, scanQrCode, getCrowd };