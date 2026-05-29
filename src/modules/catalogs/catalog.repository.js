const db = require('../../config/db');

const getAllCatalogItems = async () => {
    const { rows } = await db.query(
        `SELECT code,
                family,
                name,
                description,
                group_size,
                session_count,
                duration_days,
                sort_order,
                is_active,
                created_at,
                updated_at
         FROM pricing_catalog
         ORDER BY sort_order ASC, created_at ASC`
    );

    return rows;
};

const getCatalogItemByCode = async (code) => {
    const { rows } = await db.query(
        `SELECT code,
                family,
                name,
                description,
                group_size,
                session_count,
                duration_days,
                sort_order,
                is_active,
                created_at,
                updated_at
         FROM pricing_catalog
         WHERE code = $1`,
        [code]
    );

    if (!rows[0]) return null;

    const { rows: priceRows } = await db.query(
        `SELECT p.account_tier_code,
                t.name AS account_tier_name,
                p.price
         FROM pricing_catalog_prices p
         JOIN pricing_account_tiers t ON t.code = p.account_tier_code
         WHERE p.catalog_code = $1
         ORDER BY t.sort_order ASC`,
        [code]
    );

    return {
        ...rows[0],
        prices: priceRows,
    };
};

const createCatalogItem = async (data) => {
    const {
        code,
        family,
        name,
        description,
        groupSize,
        sessionCount,
        durationDays,
        sortOrder,
        isActive
    } = data;

    const { rows } = await db.query(
        `INSERT INTO pricing_catalog (
            code,
            family,
            name,
            description,
            group_size,
            session_count,
            duration_days,
            sort_order,
            is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING code,
                  family,
                  name,
                  description,
                  group_size,
                  session_count,
                  duration_days,
                  sort_order,
                  is_active,
                  created_at,
                  updated_at`,
        [code, family, name, description || null, groupSize || null, sessionCount || null, durationDays || null, sortOrder, isActive]
    );

    return rows[0];
};

const updateCatalogItem = async (code, data) => {
    const {
        family,
        name,
        description,
        groupSize,
        sessionCount,
        durationDays,
        sortOrder,
        isActive
    } = data;

    const { rows } = await db.query(
        `UPDATE pricing_catalog
         SET family = COALESCE($1, family),
             name = COALESCE($2, name),
             description = COALESCE($3, description),
             group_size = COALESCE($4, group_size),
             session_count = COALESCE($5, session_count),
             duration_days = COALESCE($6, duration_days),
             sort_order = COALESCE($7, sort_order),
             is_active = COALESCE($8, is_active),
             updated_at = NOW()
         WHERE code = $9
         RETURNING code,
                   family,
                   name,
                   description,
                   group_size,
                   session_count,
                   duration_days,
                   sort_order,
                   is_active,
                   created_at,
                   updated_at`,
        [family, name, description, groupSize, sessionCount, durationDays, sortOrder, isActive, code]
    );

    return rows[0];
};

const deleteCatalogItem = async (code) => {
    const { rows } = await db.query(
        `DELETE FROM pricing_catalog
         WHERE code = $1
         RETURNING code,
                   family,
                   name,
                   description,
                   group_size,
                   session_count,
                   duration_days,
                   sort_order,
                   is_active,
                   created_at,
                   updated_at`,
        [code]
    );

    return rows[0];
};

module.exports = { getAllCatalogItems, getCatalogItemByCode, createCatalogItem, updateCatalogItem, deleteCatalogItem };