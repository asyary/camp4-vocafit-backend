// Berhati-hatilah bekerja disini hai kawand
const { snap } = require('../../config/midtrans');
const repository = require('./transaction.repository');
const crypto = require('crypto');

const PRICING = {
    MEMBERSHIP_DAILY: 15000,
    PT_SESSION: 500000,      // 10 sessions
    GROUP_FITNESS_5: 325000, // 10 sessions for 5
    GROUP_FITNESS_4: 350000, // 10 sessions for 4
    GROUP_FITNESS_3: 375000  // 10 sessions for 3
};

const createPayment = async (userId, payload) => {
    const user = await repository.getUserForTransaction(userId);
    if (!user) throw new Error('User not found');

    // Calculate Base Price
    let basePrice = 0;
    if (payload.transactionType === 'MEMBERSHIP_MONTHLY') {
        basePrice = parseFloat(user.monthly_price);
    } else {
        basePrice = PRICING[payload.transactionType];
    }

    // Add Penalty Amount (if any)
    const penaltyAmount = parseFloat(user.penalty_amount) || 0;
    const grossAmount = basePrice + penaltyAmount;

    // Prepare Transaction Data
    const orderId = `VOCAFIT-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now()}`;
    let expireAt = null;

    if (payload.paymentMethod === 'CASH') {
        // TTL 24 Hours for Cash
        expireAt = new Date();
        expireAt.setHours(expireAt.getHours() + 24);
    }

    // Save to Database
    const transaction = await repository.createTransaction({
        userId,
        amount: grossAmount,
        paymentMethod: payload.paymentMethod,
        transactionType: payload.transactionType,
        orderId,
        expireAt
    });

    // Handle Midtrans if QRIS
    if (payload.paymentMethod === 'QRIS') {
        const midtransParams = {
            transaction_details: {
                order_id: orderId,
                gross_amount: grossAmount
            },
            customer_details: {
                first_name: user.full_name,
                email: user.email
            },
            enabled_payments: ["gopay", "shopeepay", "other_qris"] // Force QRIS options
        };

        const snapResponse = await snap.createTransaction(midtransParams);
        return { 
            transaction, 
            paymentUrl: snapResponse.redirect_url, 
            snapToken: snapResponse.token 
        };
    }

    return { 
        transaction, 
        message: 'Please hand the cash to the Pengurus within 24 hours.' 
    };
};

const getCashPayments = async () => {
    return await repository.getPendingCashTransactions();
};

const confirmCashPayment = async (transactionId, status) => {
    const { rows } = await db.query('SELECT * FROM transactions WHERE id = $1 AND payment_method = $2', [transactionId, 'CASH']);
    const transaction = rows[0];
    
    if (!transaction) throw new Error('Transaction not found or not a cash payment');
    if (transaction.status !== 'PENDING') throw new Error('Transaction is already processed');

    if (status === 'SUCCESS') {
        await repository.processSuccessfulPayment(transaction);
    } else {
        await repository.processFailedPayment(transaction.id);
    }
    
    return { id: transactionId, status };
};

const handleMidtransWebhook = async (notificationPayload) => {
    const {
        order_id,
        status_code,
        gross_amount,
        signature_key,
        transaction_status,
        fraud_status
    } = notificationPayload;

    // Verify Signature Key to ensure the request is actually from Midtrans
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const hashPayload = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const generatedSignature = crypto.createHash('sha512').update(hashPayload).digest('hex');

    if (generatedSignature !== signature_key) {
        throw new Error('Invalid signature key. Webhook rejected.');
    }

    // Fetch Transaction
    const transaction = await repository.getTransactionByOrderId(order_id);
    if (!transaction) {
        throw new Error('Transaction not found in database.');
    }

    // If already processed, ignore to prevent duplicate processing
    if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
        return { message: 'Transaction already processed' };
    }

    // Evaluate Status
    // Midtrans sends 'settlement' or 'capture' for successful payments
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
        if (fraud_status === 'challenge') {
            // Payment is flagged by Midtrans fraud detection, manual intervention needed
            return { message: 'Payment challenged by FDS' };
        } else {
            await repository.processSuccessfulPayment(transaction);
            return { message: 'Payment processed successfully' };
        }
    } else if (
        transaction_status === 'cancel' || 
        transaction_status === 'deny' || 
        transaction_status === 'expire'
    ) {
        await repository.processFailedPayment(transaction.id);
        return { message: 'Payment marked as failed/expired' };
    } else if (transaction_status === 'pending') {
        return { message: 'Payment still pending' };
    }

    return { message: 'Unhandled transaction status' };
};

module.exports = {
	createPayment,
	getCashPayments,
	confirmCashPayment,
	handleMidtransWebhook
};