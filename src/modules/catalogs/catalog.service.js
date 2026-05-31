const repository = require('./catalog.repository');
const {
    getCachedCatalogList,
    invalidateCatalogCache,
} = require('../../utils/pricing-cache.util');

const getCatalogItems = async () => await getCachedCatalogList({
    fetchCatalogItems: () => repository.getAllCatalogItems(),
});

const createCatalogItem = async (data) => {
    const catalog = await repository.createCatalogItem(data);
    await invalidateCatalogCache(catalog.code);
    return catalog;
};

const updateCatalogItem = async (code, data) => {
    const catalog = await repository.updateCatalogItem(code, data);
    if (!catalog) throw new Error('Catalog item not found');
    await invalidateCatalogCache(code);
    return catalog;
};

const reorderCatalogItems = async (family, orderedCodes) => {
    const catalogs = await repository.reorderCatalogItems(family, orderedCodes);
    await invalidateCatalogCache();
    return catalogs;
};

const deleteCatalogItem = async (code) => {
    const catalog = await repository.deleteCatalogItem(code);
    if (!catalog) throw new Error('Catalog item not found');
    await invalidateCatalogCache(code);
    return catalog;
};

module.exports = { getCatalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem, reorderCatalogItems };