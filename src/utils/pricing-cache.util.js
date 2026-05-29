const redisClient = require('../config/redis');

const DEFAULT_TTL_SECONDS = 60 * 15;

const getCacheKey = (catalogCode, tierCode) => `pricing:${catalogCode}:${tierCode}`;
const getCatalogListCacheKey = () => 'catalog:all';
const getCatalogItemCacheKey = (code) => `catalog:${code}`;

const readJsonCache = async (cacheKey) => {
    const cachedValue = await redisClient.get(cacheKey);
    if (cachedValue === null) return null;

    try {
        return JSON.parse(cachedValue);
    } catch (error) {
        console.error('Failed to parse cached value', error);
        return null;
    }
};

const writeJsonCache = async (cacheKey, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
    await redisClient.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds });
};

const deleteCacheKeys = async (cacheKeys) => {
    if (!cacheKeys.length) return;
    await redisClient.del(...cacheKeys);
};

const getCachedCatalogPrice = async ({ catalogCode, tierCode, fetchPrice, ttlSeconds = DEFAULT_TTL_SECONDS }) => {
    const cacheKey = getCacheKey(catalogCode, tierCode);

    try {
        const cachedPrice = await redisClient.get(cacheKey);
        if (cachedPrice !== null) {
            return Number(cachedPrice);
        }
    } catch (error) {
        console.error('Failed to read pricing cache', error);
    }

    const price = await fetchPrice();
    if (price === null || price === undefined) {
        return null;
    }

    try {
        await redisClient.set(cacheKey, String(price), { EX: ttlSeconds });
    } catch (error) {
        console.error('Failed to write pricing cache', error);
    }

    return Number(price);
};

const getCachedCatalogList = async ({ fetchCatalogItems, ttlSeconds = DEFAULT_TTL_SECONDS }) => {
    const cacheKey = getCatalogListCacheKey();

    try {
        const cachedCatalogs = await readJsonCache(cacheKey);
        if (cachedCatalogs !== null) {
            return cachedCatalogs;
        }
    } catch (error) {
        console.error('Failed to read catalog cache', error);
    }

    const catalogs = await fetchCatalogItems();

    try {
        await writeJsonCache(cacheKey, catalogs, ttlSeconds);
    } catch (error) {
        console.error('Failed to write catalog cache', error);
    }

    return catalogs;
};

const getCachedCatalogItem = async ({ code, fetchCatalogItem, ttlSeconds = DEFAULT_TTL_SECONDS }) => {
    const cacheKey = getCatalogItemCacheKey(code);

    try {
        const cachedCatalog = await readJsonCache(cacheKey);
        if (cachedCatalog !== null) {
            return cachedCatalog;
        }
    } catch (error) {
        console.error('Failed to read catalog cache', error);
    }

    const catalog = await fetchCatalogItem();
    if (catalog === null || catalog === undefined) {
        return null;
    }

    try {
        await writeJsonCache(cacheKey, catalog, ttlSeconds);
    } catch (error) {
        console.error('Failed to write catalog cache', error);
    }

    return catalog;
};

const invalidateCatalogCache = async (code = null) => {
    const cacheKeys = [getCatalogListCacheKey()];
    if (code) cacheKeys.push(getCatalogItemCacheKey(code));

    try {
        await deleteCacheKeys(cacheKeys);
    } catch (error) {
        console.error('Failed to invalidate catalog cache', error);
    }
};

module.exports = {
    getCachedCatalogPrice,
    getCachedCatalogList,
    getCachedCatalogItem,
    invalidateCatalogCache,
};