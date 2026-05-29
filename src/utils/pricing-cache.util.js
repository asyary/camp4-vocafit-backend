const redisClient = require('../config/redis');

const DEFAULT_TTL_SECONDS = 60 * 15;

const getCacheKey = (catalogCode, tierCode) => `pricing:${catalogCode}:${tierCode}`;

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

module.exports = {
    getCachedCatalogPrice,
};