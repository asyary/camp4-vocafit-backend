const service = require('./visit.service');
const { scanQrSchema } = require('./visit.validation');

const getQrCode = async (req, res) => {
    try {
        const qr = await service.generateQrToken(req.user.id);
        res.status(200).json({ success: true, data: { qr, expiresIn: '5 minutes' } });
    } catch (err) {
        next(err);
    }
};

const scanQrCode = async (req, res) => {
    try {
        const iotSecret = req.headers['x-iot-secret'];
        const { qr } = scanQrSchema.parse(req.body);
        const result = await service.processScan(qr, iotSecret);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const getCrowd = async (req, res) => {
    try {
        const crowd = await service.getCrowdMeter();
        res.status(200).json({ success: true, data: crowd });
    } catch (err) {
        next(err);
    }
};

module.exports = { getQrCode, scanQrCode, getCrowd };