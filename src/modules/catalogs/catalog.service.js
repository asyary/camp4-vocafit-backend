const repository = require('./catalog.repository');

const getCatalogItems = async () => await repository.getAllCatalogItems();

const getCatalogItem = async (code) => {
    const catalog = await repository.getCatalogItemByCode(code);
    if (!catalog) throw new Error('Catalog item not found');
    return catalog;
};

const createCatalogItem = async (data) => await repository.createCatalogItem(data);

const updateCatalogItem = async (code, data) => {
    const catalog = await repository.updateCatalogItem(code, data);
    if (!catalog) throw new Error('Catalog item not found');
    return catalog;
};

const deleteCatalogItem = async (code) => {
    const catalog = await repository.deleteCatalogItem(code);
    if (!catalog) throw new Error('Catalog item not found');
    return catalog;
};

module.exports = { getCatalogItems, getCatalogItem, createCatalogItem, updateCatalogItem, deleteCatalogItem };