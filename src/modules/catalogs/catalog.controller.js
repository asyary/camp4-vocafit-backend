const service = require('./catalog.service');
const { createCatalogSchema, updateCatalogSchema, reorderCatalogSchema } = require('./catalog.validation');

const getCatalogItems = async (req, res, next) => {
    try {
        const catalogs = await service.getCatalogItems();
        res.success(catalogs, 'Catalog items retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const createCatalogItem = async (req, res, next) => {
    try {
        const parsedBody = createCatalogSchema.parse(req.body);
        const catalog = await service.createCatalogItem(parsedBody);
        res.success(catalog, 'Catalog item created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const updateCatalogItem = async (req, res, next) => {
    try {
        const parsedBody = updateCatalogSchema.parse(req.body);
        const catalog = await service.updateCatalogItem(req.params.code, parsedBody);
        res.success(catalog, 'Catalog item updated successfully');
    } catch (err) {
        next(err);
    }
};

const reorderCatalogItems = async (req, res, next) => {
    try {
        const parsedBody = reorderCatalogSchema.parse(req.body);
        const catalogs = await service.reorderCatalogItems(parsedBody.family, parsedBody.orderedCodes);
        res.success(catalogs, 'Catalog items reordered successfully');
    } catch (err) {
        next(err);
    }
};

const deleteCatalogItem = async (req, res, next) => {
    try {
        const catalog = await service.deleteCatalogItem(req.params.code);
        res.success(catalog, 'Catalog item deleted successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = { getCatalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem, reorderCatalogItems };