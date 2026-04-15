// Berhati-hatilah bekerja disini hai kawand
const db = require('../../config/db');

const getUserForTransaction = async (userId) => {
    const { rows } = await db.query(
        'SELECT id, email, full_name, monthly_price, penalty_amount FROM users WHERE id = $1',
        [userId]
    );
    return rows[0];
};

const createTransaction = async (data) => {
    const { userId, amount, paymentMethod, transactionType, expireAt, orderId } = data;
    
    const { rows } = await db.query(
        `INSERT INTO transactions 
        (user_id, amount, payment_method, transaction_type, midtrans_order_id, expire_at) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [userId, amount, paymentMethod, transactionType, orderId, expireAt]
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

const getTransactionByOrderId = async (orderId) => {
    const { rows } = await db.query(
        'SELECT * FROM transactions WHERE midtrans_order_id = $1',
        [orderId]
    );
    return rows[0];
};

const processSuccessfulPayment = async (transaction) => {
    // Sequentially exec queries with BEGIN/COMMIT for atomic transactions
    
    // 1. Update Transaction Status
    await db.query(
        'UPDATE transactions SET status = $1 WHERE id = $2',
        ['SUCCESS', transaction.id]
    );

    // 2. Reset User's Penalty Amount (since it was paid in this transaction)
    await db.query(
        'UPDATE users SET penalty_amount = 0 WHERE id = $1',
        [transaction.user_id]
    );

    // 3. Grant Membership if applicable
    if (['MEMBERSHIP_DAILY', 'MEMBERSHIP_MONTHLY'].includes(transaction.transaction_type)) {
        const startDate = new Date();
        const endDate = new Date();

        if (transaction.transaction_type === 'MEMBERSHIP_DAILY') {
            // Expires at 23:59:59 today
            endDate.setHours(23, 59, 59, 999);
        } else if (transaction.transaction_type === 'MEMBERSHIP_MONTHLY') {
            // Expires in 30 days
            endDate.setDate(endDate.getDate() + 30);
        }

        await db.query(
            `INSERT INTO memberships (user_id, type, start_date, end_date) 
             VALUES ($1, $2, $3, $4)`,
            [transaction.user_id, transaction.transaction_type.split('_')[1].toLowerCase(), startDate, endDate]
        );
    }
    
    // Might QoL update: PT_SESSION and GROUP_FITNESS can insert into a `user_packages` table
};

const processFailedPayment = async (transactionId) => {
    await db.query(
        'UPDATE transactions SET status = $1 WHERE id = $2',
        ['FAILED', transactionId]
    );
};

module.exports = { 
    getUserForTransaction, 
    createTransaction, 
    getPendingCashTransactions,
    updateTransactionStatus,
	getTransactionByOrderId,
    processSuccessfulPayment,
    processFailedPayment
};