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

const MIDTRANS_SUCCESS_STATUSES = new Set(['capture', 'settlement']);
const MIDTRANS_FAILURE_STATUSES = new Set(['deny', 'expire', 'cancel']);
const MIDTRANS_REVERSAL_STATUSES = new Set(['refund', 'partial_refund', 'chargeback']);

const createPayment = async (userId, payload) => {
    const user = await repository.getUserForTransaction(userId);
    if (!user) throw new Error('User not found');

    const activeOrder = await repository.getActiveOrderByUserId(userId);
    if (activeOrder) {
        const err = new Error('You already have an active order');
        err.status = 409;
        err.data = { ...activeOrder };
        delete err.data.snap_token;
        throw err;
    }

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
	const orderId = `VOCAFIT-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Math.floor(Date.now() / 1000).toString(16).toUpperCase()}`;
    let expireAt = null;

    if (payload.paymentMethod === 'CASH') {
        // TTL 24 Hours for Cash
        expireAt = new Date();
        expireAt.setHours(expireAt.getHours() + 24);
    } else if (payload.paymentMethod === 'QRIS') {
		expireAt = new Date();
		expireAt.setMinutes(expireAt.getMinutes() + 30);
	}
    
    let paymentUrl = null;
    let snapToken = null;

    // Handle Midtrans if QRIS
    if (payload.paymentMethod === 'QRIS') {
		const midtransParams = {
			transaction_details: {
			order_id: orderId,
			gross_amount: grossAmount
			},
			item_details: [
			{
				id: payload.transactionType,
				price: grossAmount,
				quantity: 1,
				name: payload.transactionType.replace(/_/g, ' ')
			}
			],
			customer_details: {
			first_name: user.full_name,
			email: user.email
			}
			// enabled_payments: ["gopay", "shopeepay", "other_qris"] // Now using SNAP preferences
		};

        const snapResponse = await snap.createTransaction(midtransParams);
        paymentUrl = snapResponse.redirect_url;
        snapToken = snapResponse.token;
    }

    // Save to Database
    const transaction = await repository.createTransaction({
        userId,
        amount: grossAmount,
        paymentMethod: payload.paymentMethod,
        transactionType: payload.transactionType,
        orderId,
        expireAt,
        paymentUrl,
        snapToken,
        penaltyAmount
    });

	delete transaction.snap_token;
	
    return transaction;
};

const getCashPayments = async () => {
    return await repository.getPendingCashTransactions();
};

const confirmCashPayment = async (transactionId, status) => {
    const transaction = await repository.getCashTransactionById(transactionId);
    
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

    if (transaction.status === 'REFUNDED') {
        return { message: 'Transaction already refunded' };
    }

    if (MIDTRANS_SUCCESS_STATUSES.has(transaction_status)) {
        if (fraud_status === 'challenge') {
            // Payment is flagged by Midtrans fraud detection, manual intervention needed
            return { message: 'Payment challenged by FDS' };
        }

        if (transaction.status === 'FAILED') {
            return { message: 'Ignoring stale success webhook' };
        }

        if (transaction.status === 'REFUNDED') {
            return { message: 'Transaction already refunded' };
        }

        // Apply business side-effects as soon as payment is captured/settled.
        // 'capture' is considered successful by Midtrans, even if funds are not settled yet.
        if (transaction.status !== 'SUCCESS') {
            await repository.processSuccessfulPayment(transaction);
        }

        if (transaction_status === 'settlement' && !transaction.settled_at) {
            await repository.updateTransactionSettledAt(transaction.id, new Date());
            return { message: 'Payment settled successfully' };
        }

        if (transaction_status === 'capture') {
            return { message: 'Payment captured successfully' };
        }

        return { message: 'Payment processed successfully' };
    }

    if (MIDTRANS_REVERSAL_STATUSES.has(transaction_status)) {
        if (transaction.status === 'SUCCESS') {
            await repository.processRefundedPayment(transaction.id);
            return { message: 'Payment reversed/refunded successfully' };
        }

        if (transaction.status === 'REFUNDED') {
            return { message: 'Transaction already refunded' };
        }

        return { message: 'Ignoring stale refund/cancel webhook' };
    }

    if (MIDTRANS_FAILURE_STATUSES.has(transaction_status)) {
        if (transaction.status === 'FAILED') {
            return { message: 'Transaction already failed' };
        }

        if (transaction.status === 'REFUNDED') {
            return { message: 'Ignoring stale failure webhook' };
        }

        if (transaction.status === 'SUCCESS' && transaction.settled_at) {
            return { message: 'Ignoring stale failure webhook' };
        }

        await repository.processFailedPayment(transaction.id);
        return { message: 'Payment marked as failed/expired' };
    }

    if (transaction_status === 'pending') {
		if (transaction.status !== 'PENDING') {
			return { message: 'Ignoring stale pending webhook' };
		}

		// payment_type is cstore for Indomaret/Alfamart
		await repository.updateTransactionExpiry(transaction.id, new Date(Date.now() + 30 * 60 * 1000));
        return { message: 'Payment pending funds' };
    }

    return { message: 'Unhandled transaction status' };
};

module.exports = {
	createPayment,
	getCashPayments,
	confirmCashPayment,
	handleMidtransWebhook
};