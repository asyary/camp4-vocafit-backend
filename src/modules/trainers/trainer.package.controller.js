const service = require('./trainer.package.service');
const {
    packageIdParamSchema,
    sessionIdParamSchema,
    bookSessionSchema,
    cancelSessionSchema,
} = require('./trainer.package.validation');

const getMyPackages = async (req, res, next) => {
    try {
        const packages = await service.getMyPackages(req.user.id);
        res.success(packages, 'Trainer packages retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const getPackageDetails = async (req, res, next) => {
    try {
        const { packageId } = packageIdParamSchema.parse(req.params);
        const packageDetails = await service.getPackageDetails(req.user.id, req.user.role, packageId);
        res.success(packageDetails, 'Trainer package retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const bookSession = async (req, res, next) => {
    try {
        const { packageId } = packageIdParamSchema.parse(req.params);
        const parsedBody = bookSessionSchema.parse(req.body);
        const result = await service.bookSession(req.user.id, packageId, parsedBody);
        res.success(result, 'Trainer session booked successfully', 201);
    } catch (err) {
        next(err);
    }
};

const cancelSession = async (req, res, next) => {
    try {
        const { sessionId } = sessionIdParamSchema.parse(req.params);
        const parsedBody = cancelSessionSchema.parse(req.body);
        const result = await service.cancelSession(req.user.id, req.user.role, sessionId, parsedBody);
        res.success(result, 'Trainer session cancelled successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getMyPackages,
    getPackageDetails,
    bookSession,
    cancelSession,
};