const service = require('./visit.service');
const { scanQrSchema } = require('./visit.validation');
const { paginationSchema } = require('../../utils/validation.util');

const getQrCode = async (req, res, next) => {
    try {
        const qr = await service.generateQrToken(req.user.id);
        res.success({ qr, expiresIn: '5 minutes' }, 'QR code generated successfully');
    } catch (err) {
        next(err);
    }
};

const scanQrCode = async (req, res, next) => {
    try {
        const iotSecret = req.headers['x-iot-secret'];
        const { qr } = scanQrSchema.parse(req.body);
        const result = await service.processScan(qr, iotSecret);
        res.success(result, 'QR code scanned successfully');
    } catch (err) {
        next(err);
    }
};

const getCrowd = async (req, res, next) => {
    try {
        const crowd = await service.getCrowdMeter();
        res.success(crowd, 'Crowd meter data retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const getMyVisitHistory = async (req, res, next) => {
    try {
        const query = paginationSchema.parse(req.query);
        const result = await service.getMyVisitHistory(req.user.id, query);
        res.success(result.data, 'Visit history retrieved successfully', 200, { 
            page: result.page, 
            limit: result.limit, 
            total_pages: result.total_pages,
            total_data: result.total_data
        });
    } catch (err) {
        next(err);
    }
};

const getMyVisitStatus = async (req, res, next) => {
    try {
        const status = await service.getMyVisitStatus(req.user.id);
        res.success(status, 'Visit status retrieved successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = { getQrCode, scanQrCode, getCrowd, getMyVisitHistory, getMyVisitStatus };