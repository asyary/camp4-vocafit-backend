// Berhati-hatilah bekerja disini hai kawand
const db = require('../../config/db');

const getUserForTransaction = async (userId) => {
    const { rows } = await db.query(
        'SELECT id, email, full_name, monthly_price, penalty_amount FROM users WHERE id = $1',
        [userId]
    );
    return rows[0];
};

const getActiveOrderByUserId = async (userId) => {
    const { rows } = await db.query(
        `SELECT *
         FROM transactions
         WHERE user_id = $1
           AND status = 'PENDING'
           AND (expire_at IS NULL OR expire_at > NOW())
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
    );
    return rows[0];
};

const getLatestMembershipEndDate = async (userId) => {
    const { rows } = await db.query(
        `SELECT MAX(end_date) AS latest_end_date
         FROM memberships
         WHERE user_id = $1`,
        [userId]
    );
    return rows[0]?.latest_end_date || null;
};

const createTransaction = async (data) => {
    const { userId, amount, paymentMethod, transactionType, expireAt, orderId, paymentUrl, snapToken } = data;
    
    const { rows } = await db.query(
        `INSERT INTO transactions 
        (user_id, amount, payment_method, transaction_type, order_id, expire_at, payment_url, snap_token) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [userId, amount, paymentMethod, transactionType, orderId, expireAt, paymentUrl, snapToken]
    );
    return rows[0];
};

const getPendingCashTransactions = async () => {
    // Only fetch cash transactions that haven't expired yet
    const { rows } = await db.query(
        `SELECT t.*, u.full_name, u.email 
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         WHERE t.payment_method = 'CASH' 
         AND t.status = 'PENDING' 
         AND t.expire_at > NOW()
         ORDER BY t.created_at ASC`
    );
    return rows;
};

const updateTransactionStatus = async (transactionId, status) => {
    const { rows } = await db.query(
        'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *',
        [status, transactionId]
    );
    return rows[0];
};

const updateTransactionExpiry = async (transactionId, expireAt) => {
	const { rows } = await db.query(
		'UPDATE transactions SET expire_at = $1 WHERE id = $2 RETURNING *',
		[expireAt, transactionId]
	);
	return rows[0];
};

const updateTransactionSettledAt = async (transactionId, settledAt) => {
    const { rows } = await db.query(
        'UPDATE transactions SET settled_at = $1 WHERE id = $2 RETURNING *',
        [settledAt, transactionId]
    );
    return rows[0];
};

const getTransactionByOrderId = async (orderId) => {
    const { rows } = await db.query(
        'SELECT * FROM transactions WHERE order_id = $1',
        [orderId]
    );
    return rows[0];
};

const lockTransactionForUpdate = async (client, transactionId) => {
    const { rows } = await client.query(
        'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
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
        if (['MEMBERSHIP_DAILY', 'MEMBERSHIP_MONTHLY'].includes(transaction.transaction_type)) {
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

            if (transaction.transaction_type === 'MEMBERSHIP_DAILY') {
                endDate.setHours(23, 59, 59, 999);
            } else if (transaction.transaction_type === 'MEMBERSHIP_MONTHLY') {
                endDate.setDate(endDate.getDate() + 30);
            }

            const type = transaction.transaction_type.split('_')[1].toLowerCase();

            const { rowCount: exists } = await client.query(
                `SELECT 1 FROM memberships WHERE user_id = $1 AND type = $2 AND start_date = $3 AND end_date = $4 LIMIT 1`,
                [transaction.user_id, type, startDate, endDate]
            );

            if (!exists) {
                await client.query(
                    `INSERT INTO memberships (user_id, type, start_date, end_date) VALUES ($1, $2, $3, $4)`,
                    [transaction.user_id, type, startDate, endDate]
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

        // If success but not yet settled (settled_at IS NULL), allow reverting to FAILED
        if (current.status === 'SUCCESS' && current.settled_at) {
            // already settled funds; do not mark as failed
            return current;
        }

        const { rows } = await client.query(
            'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *',
            ['FAILED', transactionId]
        );

        return rows[0];
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

        const { rows } = await client.query(
            'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *',
            ['REFUNDED', transactionId]
        );

        return rows[0];
    });
};

module.exports = { 
    getUserForTransaction, 
    getActiveOrderByUserId,
    getLatestMembershipEndDate,
    createTransaction, 
    getPendingCashTransactions,
    updateTransactionStatus,
    updateTransactionExpiry,
	getTransactionByOrderId,
    processRefundedPayment,
    processSuccessfulPayment,
    processFailedPayment
};