const db = require('../../config/db');

const getAllCatalogItems = async () => {
    const { rows } = await db.query(
        `SELECT c.code,
                c.family,
                c.name,
                c.description,
                c.group_size,
                c.session_count,
                c.duration_days,
                COALESCE(
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'tier_code', t.code,
                            'tier_name', t.name,
                            'price', p.price
                        ) ORDER BY t.sort_order ASC
                    ) FILTER (WHERE p.catalog_code IS NOT NULL),
                    '[]'::jsonb
                ) AS prices,
                c.sort_order,
                c.is_active,
                c.created_at,
                c.updated_at
         FROM pricing_catalog c
         LEFT JOIN pricing_catalog_prices p ON p.catalog_code = c.code
         LEFT JOIN pricing_account_tiers t ON t.code = p.account_tier_code
         GROUP BY c.code,
                  c.family,
                  c.name,
                  c.description,
                  c.group_size,
                  c.session_count,
                  c.duration_days,
                  c.sort_order,
                  c.is_active,
                  c.created_at,
                  c.updated_at
         ORDER BY c.family ASC, c.sort_order ASC, c.created_at ASC`
    );

    return rows;
};

const createCatalogItem = async (data) => {
    return await db.withTransaction(async (client) => {
        const {
            code,
            family,
            name,
            description,
            groupSize,
            sessionCount,
            durationDays,
            isActive
        } = data;

        await client.query('LOCK TABLE pricing_catalog IN SHARE ROW EXCLUSIVE MODE');
        const { rows: nextRows } = await client.query(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM pricing_catalog
             WHERE family = $1`,
            [family]
        );
        const resolvedSortOrder = Number(nextRows[0]?.next_sort_order ?? 0);

        const { rows } = await client.query(
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
            [code, family, name, description || null, groupSize || null, sessionCount || null, durationDays || null, resolvedSortOrder, isActive]
        );

        return rows[0];
    });
};

const updateCatalogItem = async (code, data) => {
    return await db.withTransaction(async (client) => {
        const {
            family,
            name,
            description,
            groupSize,
            sessionCount,
            durationDays,
            isActive
        } = data;

        const { rows: currentRows } = await client.query(
            `SELECT code, family, sort_order
             FROM pricing_catalog
             WHERE code = $1
             FOR UPDATE`,
            [code]
        );

        const current = currentRows[0];
        if (!current) return null;

        let resolvedFamily = current.family;
        let resolvedSortOrder = current.sort_order;

        if (family && family !== current.family) {
            resolvedFamily = family;

            await client.query(
                `UPDATE pricing_catalog
                 SET sort_order = sort_order - 1,
                     updated_at = NOW()
                 WHERE family = $1
                   AND sort_order > $2`,
                [current.family, current.sort_order]
            );

            const { rows: nextRows } = await client.query(
                `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
                 FROM pricing_catalog
                 WHERE family = $1`,
                [resolvedFamily]
            );
            resolvedSortOrder = Number(nextRows[0]?.next_sort_order ?? 0);
        }

        const { rows } = await client.query(
            `UPDATE pricing_catalog
             SET family = $1,
                 name = COALESCE($2, name),
                 description = COALESCE($3, description),
                 group_size = COALESCE($4, group_size),
                 session_count = COALESCE($5, session_count),
                 duration_days = COALESCE($6, duration_days),
                 sort_order = $7,
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
            [resolvedFamily, name, description, groupSize, sessionCount, durationDays, resolvedSortOrder, isActive, code]
        );

        return rows[0];
    });
};

const reorderCatalogItems = async (family, orderedCodes) => {
    return await db.withTransaction(async (client) => {
        const { rows: existingRows } = await client.query(
            `SELECT code
             FROM pricing_catalog
             WHERE family = $1
             ORDER BY sort_order ASC, created_at ASC
             FOR UPDATE`
            , [family]
        );

        const existingCodes = existingRows.map((row) => row.code);
        const sameLength = orderedCodes.length === existingCodes.length;
        const sameSet = sameLength && orderedCodes.every((code) => existingCodes.includes(code));

        if (!sameSet) {
            throw new Error('Ordered catalog codes must match all existing catalog items');
        }

        const updatedRows = [];
        for (let index = 0; index < orderedCodes.length; index += 1) {
            const code = orderedCodes[index];
            const { rows } = await client.query(
                `UPDATE pricing_catalog
                 SET sort_order = $1,
                     updated_at = NOW()
                 WHERE code = $2
                   AND family = $3
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
                [index, code, family]
            );

            updatedRows.push(rows[0]);
        }

        return updatedRows;
    });
};

const deleteCatalogItem = async (code) => {
    return await db.withTransaction(async (client) => {
        const { rows: existingRows } = await client.query(
            `SELECT code, family, sort_order
             FROM pricing_catalog
             WHERE code = $1
             FOR UPDATE`,
            [code]
        );

        const existing = existingRows[0];
        if (!existing) return null;

        const { rows } = await client.query(
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

        await client.query(
            `UPDATE pricing_catalog
             SET sort_order = sort_order - 1,
                 updated_at = NOW()
             WHERE family = $1
               AND sort_order > $2`,
            [existing.family, existing.sort_order]
        );

        return rows[0];
    });
};

module.exports = { getAllCatalogItems, createCatalogItem, updateCatalogItem, reorderCatalogItems, deleteCatalogItem };