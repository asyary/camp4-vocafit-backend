// Berhati-hatilah bekerja disini hai kawand
const db = require('../../config/db');
const { getCachedCatalogPrice } = require('../../utils/pricing-cache.util');

const TRANSACTION_SELECT_FIELDS = `
    t.id,
    t.user_id,
    t.amount,
    t.payment_method,
    t.status,
    t.penalty_amount,
    t.catalog_code AS transaction_type,
    c.family AS transaction_family,
    c.name AS catalog_name,
    t.account_tier_code,
    t.order_id,
    t.payment_url,
    t.expire_at,
    t.created_at,
    t.settled_at
`;

const getUserForTransaction = async (userId) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.full_name,
                u.penalty_amount,
                uat.account_tier_code AS membership_price_code
         FROM users u
         LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
         WHERE u.id = $1 AND u.is_verified = TRUE`,
        [userId]
    );
    return rows[0];
};

const getPricingCatalogItem = async (catalogCode) => {
    const { rows } = await db.query(
        `SELECT code, family, name, group_size, session_count, duration_days
         FROM pricing_catalog
         WHERE code = $1
           AND is_active = TRUE`,
        [catalogCode]
    );

    return rows[0];
};

const getPricingCatalogPrice = async (catalogCode, tierCode) => {
    return await getCachedCatalogPrice({
        catalogCode,
        tierCode,
        fetchPrice: async () => {
            const { rows } = await db.query(
                `SELECT p.price
                 FROM pricing_catalog_prices p
                 JOIN pricing_catalog c ON c.code = p.catalog_code
                 WHERE p.catalog_code = $1
                   AND p.account_tier_code = $2
                   AND c.is_active = TRUE
                 LIMIT 1`,
                [catalogCode, tierCode]
            );

            return rows[0]?.price ?? null;
        }
    });
};

const getActiveOrderByUserId = async (userId) => {
    const { rows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         WHERE t.user_id = $1
           AND t.status = 'PENDING'
           AND (t.expire_at IS NULL OR t.expire_at > NOW())
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [userId]
    );
    return rows[0];
};

const createTransaction = async (data) => {
    const { userId, amount, paymentMethod, transactionType, accountTierCode, expireAt, orderId, paymentUrl, snapToken, penaltyAmount } = data;
    
    const { rows } = await db.query(
        `INSERT INTO transactions 
        (user_id, amount, payment_method, catalog_code, account_tier_code, order_id, expire_at, payment_url, snap_token, penalty_amount) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING id`,
        [userId, amount, paymentMethod, transactionType, accountTierCode || null, orderId, expireAt, paymentUrl, snapToken, penaltyAmount || 0]
    );
    const transactionId = rows[0]?.id;
    if (!transactionId) return null;

    const { rows: fullRows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         WHERE t.id = $1`,
        [transactionId]
    );

    return fullRows[0];
};

const isMembershipTransaction = (transaction) => (
    transaction?.transaction_family === 'MEMBERSHIP' ||
    String(transaction?.transaction_type || '').startsWith('MEMBERSHIP_')
);

const getPendingCashTransactions = async () => {
    // Only fetch cash transactions that haven't expired yet
    const { rows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         WHERE t.payment_method = 'CASH' 
         AND t.status = 'PENDING' 
         AND t.expire_at > NOW()
         ORDER BY t.created_at ASC`
    );
    return rows;
};

const updateTransactionExpiry = async (transactionId, expireAt) => {
	const { rows } = await db.query(
		'UPDATE transactions SET expire_at = $1 WHERE id = $2 RETURNING id',
		[expireAt, transactionId]
	);
	if (!rows[0]) return null;

    const { rows: fullRows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         WHERE t.id = $1`,
        [transactionId]
    );

    return fullRows[0];
};

const updateTransactionSettledAt = async (transactionId, settledAt) => {
    const { rows } = await db.query(
        'UPDATE transactions SET settled_at = $1 WHERE id = $2 RETURNING id',
        [settledAt, transactionId]
    );
    if (!rows[0]) return null;

    const { rows: fullRows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         WHERE t.id = $1`,
        [transactionId]
    );

    return fullRows[0];
};

const expireStaleTransactions = async () => {
    const { rowCount } = await db.query(
        `UPDATE transactions
         SET status = 'FAILED'
         WHERE status = 'PENDING'
           AND expire_at IS NOT NULL
           AND expire_at <= NOW()`
    );

    return rowCount;
};

const cancelMembershipByTransactionId = async (client, transactionId) => {
    const { rows } = await client.query(
        'UPDATE memberships SET canceled_at = COALESCE(canceled_at, NOW()) WHERE transaction_id = $1 RETURNING *',
        [transactionId]
    );
    return rows[0];
};

const restorePenaltyAmount = async (client, transaction) => {
    const penaltyAmount = parseFloat(transaction.penalty_amount) || 0;

    if (!penaltyAmount) return null;

    const { rows } = await client.query(
        'UPDATE users SET penalty_amount = COALESCE(penalty_amount, 0) + $1 WHERE id = $2 RETURNING *',
        [penaltyAmount, transaction.user_id]
    );

    return rows[0];
};

const getTransactionByOrderId = async (orderId) => {
    const { rows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.order_id = $1`,
        [orderId]
    );
    return rows[0];
};

const getCashTransactionById = async (transactionId) => {
    const { rows } = await db.query(
                `SELECT ${TRANSACTION_SELECT_FIELDS}
                 FROM transactions t
                 JOIN pricing_catalog c ON c.code = t.catalog_code
                 LEFT JOIN users u ON u.id = t.user_id
                 WHERE t.id = $1
                     AND t.payment_method = 'CASH'`,
        [transactionId]
    );
    return rows[0];
};

const getTransactionById = async (transactionId) => {
    const { rows } = await db.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.id = $1`,
        [transactionId]
    );

    return rows[0];
};

const getTransactionByIdForUser = async (transactionId, userId) => {
    const { rows } = await db.query(
                `SELECT ${TRANSACTION_SELECT_FIELDS}
                 FROM transactions t
                 JOIN pricing_catalog c ON c.code = t.catalog_code
                 LEFT JOIN users u ON u.id = t.user_id
                 WHERE t.id = $1
                     AND t.user_id = $2`,
        [transactionId, userId]
    );

    return rows[0];
};

const getTransactionsHistory = async ({ userId, isPengurus, limit, offset }) => {
    const whereClause = isPengurus ? '' : 'WHERE t.user_id = $1';
    const baseParams = isPengurus ? [] : [userId];
    const limitParamIndex = baseParams.length + 1;
    const offsetParamIndex = baseParams.length + 2;

    const [dataResult, countResult] = await Promise.all([
        db.query(
            `SELECT ${TRANSACTION_SELECT_FIELDS}
             FROM transactions t
             JOIN pricing_catalog c ON c.code = t.catalog_code
             LEFT JOIN users u ON u.id = t.user_id
             ${whereClause}
             ORDER BY t.created_at DESC
             LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
            [...baseParams, limit, offset]
        ),
        db.query(
            `SELECT COUNT(*)::int AS count
             FROM transactions t
             ${whereClause}`,
            baseParams
        )
    ]);

    return {
        rows: dataResult.rows,
        totalCount: countResult.rows[0]?.count ?? 0
    };
};

const lockTransactionForUpdate = async (client, transactionId) => {
    const { rows } = await client.query(
        `SELECT ${TRANSACTION_SELECT_FIELDS}
         FROM transactions t
         JOIN pricing_catalog c ON c.code = t.catalog_code
         WHERE t.id = $1
         FOR UPDATE OF t`,
        [transactionId]
    );

    return rows[0];
};

const processSuccessfulPayment = async (transaction) => {
    // Make processing atomic and idempotent using a DB transaction
    return await db.withTransaction(async (client) => {
        const current = await lockTransactionForUpdate(client, transaction.id);
        if (!current) throw new Error('Transaction not found');

        // If already settled or refunded, do not re-apply the success side effects.
        if (current.status === 'SUCCESS' || current.status === 'REFUNDED') return current;

        // 1. Update Transaction Status
        await client.query('UPDATE transactions SET status = $1 WHERE id = $2', ['SUCCESS', transaction.id]);

        // 2. Reset User's Penalty Amount (since it was paid in this transaction)
        await client.query('UPDATE users SET penalty_amount = 0 WHERE id = $1', [transaction.user_id]);

        // 3. Grant Membership if applicable (avoid duplicate membership insert)
        if (isMembershipTransaction(transaction)) {
            const { rows: latestRows } = await client.query(
                `SELECT MAX(end_date) AS latest_end_date FROM memberships WHERE user_id = $1`,
                [transaction.user_id]
            );
            const latestMembershipEndDate = latestRows[0]?.latest_end_date || null;
            const now = new Date();
            const startDate = latestMembershipEndDate && new Date(latestMembershipEndDate) > now
                ? new Date(latestMembershipEndDate)
                : now;
            const endDate = new Date(startDate.getTime());

            // Determine membership duration from the pricing_catalog so durations are data-driven
            const { rows: catalogRows } = await client.query(
                `SELECT duration_days FROM pricing_catalog WHERE code = $1 AND is_active = TRUE`,
                [transaction.transaction_type]
            );
            const durationDays = catalogRows[0] ? parseInt(catalogRows[0].duration_days, 10) : null;

            if (durationDays === 1) {
                // Single-day membership: end at end of day, or tomorrow if after 9 PM
                const isSameDate = (left, right) => (
                    left.getFullYear() === right.getFullYear() &&
                    left.getMonth() === right.getMonth() &&
                    left.getDate() === right.getDate()
                );
                const afterNinePm = now.getHours() >= 21;

                if (afterNinePm && isSameDate(startDate, now)) {
                    endDate.setDate(endDate.getDate() + 1);
                }

                endDate.setHours(23, 59, 59, 999);
            } else if (Number.isInteger(durationDays) && durationDays > 0) {
                // Multi-day membership: add specified duration
                endDate.setDate(endDate.getDate() + durationDays);
            } else {
                // Fallback: default to 30 days if catalog is missing or invalid
                endDate.setDate(endDate.getDate() + 30);
            }

            const type = transaction.transaction_type.split('_')[1].toLowerCase();

            const { rowCount: exists } = await client.query(
                `SELECT 1 FROM memberships WHERE user_id = $1 AND plan_code = $2 AND start_date = $3 AND end_date = $4 LIMIT 1`,
                [transaction.user_id, transaction.transaction_type, startDate, endDate]
            );

            if (!exists) {
                await client.query(
                    `INSERT INTO memberships (user_id, transaction_id, plan_code, type, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [transaction.user_id, transaction.id, transaction.transaction_type, type, startDate, endDate]
                );
            }
        }

        return { ...current, status: 'SUCCESS' };
    });
};

const processFailedPayment = async (transactionId) => {
    return await db.withTransaction(async (client) => {
        const current = await lockTransactionForUpdate(client, transactionId);
        if (!current) throw new Error('Transaction not found');

        // If already failed, return
        if (current.status === 'FAILED') return current;

        // If already refunded, do not overwrite
        if (current.status === 'REFUNDED') return current;

        // If success but already settled, do not revert into FAILED
        if (current.status === 'SUCCESS' && current.settled_at) {
            return current;
        }

        if (current.status === 'SUCCESS' && isMembershipTransaction(current)) {
            await cancelMembershipByTransactionId(client, current.id);
        }

        if (current.status === 'SUCCESS') {
            await restorePenaltyAmount(client, current);
        }

        const { rows } = await client.query(
            'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING id',
            ['FAILED', transactionId]
        );
        if (!rows[0]) return null;

        const { rows: fullRows } = await client.query(
            `SELECT ${TRANSACTION_SELECT_FIELDS}
             FROM transactions t
             JOIN pricing_catalog c ON c.code = t.catalog_code
             WHERE t.id = $1`,
            [transactionId]
        );

        return fullRows[0];
    });
};

const processRefundedPayment = async (transactionId) => {
    return await db.withTransaction(async (client) => {
        const current = await lockTransactionForUpdate(client, transactionId);
        if (!current) throw new Error('Transaction not found');

        // Refunds only make sense after a successful and settled payment.
        if (current.status === 'REFUNDED') return current;
        if (current.status !== 'SUCCESS') return current;
        if (!current.settled_at) return current;

        if (isMembershipTransaction(current)) {
            await cancelMembershipByTransactionId(client, current.id);
        }

        await restorePenaltyAmount(client, current);

        const { rows } = await client.query(
            'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING id',
            ['REFUNDED', transactionId]
        );
        if (!rows[0]) return null;

        const { rows: fullRows } = await client.query(
            `SELECT ${TRANSACTION_SELECT_FIELDS}
             FROM transactions t
             JOIN pricing_catalog c ON c.code = t.catalog_code
             WHERE t.id = $1`,
            [transactionId]
        );

        return fullRows[0];
    });
};

module.exports = { 
    getUserForTransaction, 
    getActiveOrderByUserId,
    getPricingCatalogItem,
    getPricingCatalogPrice,
    createTransaction, 
    getPendingCashTransactions,
    updateTransactionExpiry,
	expireStaleTransactions,
	getCashTransactionById,
	getTransactionById,
	getTransactionByIdForUser,
	getTransactionsHistory,
	getTransactionByOrderId,
    processRefundedPayment,
    processSuccessfulPayment,
    processFailedPayment,
    updateTransactionSettledAt
};