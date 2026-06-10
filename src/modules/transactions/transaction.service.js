// Berhati-hatilah bekerja disini hai kawand
const { snap } = require('../../config/midtrans');
const repository = require('./transaction.repository');
const crypto = require('crypto');
const { queueOrderInvoiceEmail, queuePaymentReceiptEmail } = require('../../utils/email-queue.util');
const { sendTransactionNotification } = require('../notifications/notifications.service');

const MIDTRANS_SUCCESS_STATUSES = new Set(['capture', 'settlement']);
const MIDTRANS_FAILURE_STATUSES = new Set(['deny', 'expire', 'cancel']);
const MIDTRANS_REVERSAL_STATUSES = new Set(['refund', 'partial_refund', 'chargeback']);

const normalizeEmailList = (emails = []) => Array.from(
    new Set(
        (Array.isArray(emails) ? emails : [])
            .map((email) => String(email || '').trim().toLowerCase())
            .filter(Boolean)
    )
);

const createPayment = async (userId, payload) => {
    const user = await repository.getUserForTransaction(userId);
    if (!user) throw new Error('User not found');

    const activeOrder = await repository.getActiveOrderByUserId(userId);
    if (activeOrder) {
        const err = new Error('You already have an active order');
        err.status = 409;
        err.data = { ...activeOrder };
        throw err;
    }

    const catalogItem = await repository.getPricingCatalogItem(payload.transactionType);
    if (!catalogItem) {
        throw new Error('Pricing option not found');
    }

    let trainerId = null;
    let trainerParticipantEmails = [];

    if (catalogItem.family === 'PERSONAL_TRAINER') {
        if (!payload.trainerId) {
            const err = new Error('Trainer selection is required for personal trainer packages');
            err.status = 400;
            throw err;
        }

        trainerId = payload.trainerId;
        const trainer = await repository.getTrainerById(trainerId);
        if (!trainer) {
            const err = new Error('Trainer not found or inactive');
            err.status = 404;
            throw err;
        }

        if (!await repository.hasActiveMembership(userId)) {
            const err = new Error('Active membership required for trainer packages');
            err.status = 403;
            throw err;
        }

        trainerParticipantEmails = normalizeEmailList([
            user.email,
            ...(Array.isArray(payload.participantEmails) ? payload.participantEmails : [])
        ]);

        if (trainerParticipantEmails.length !== Number(catalogItem.group_size)) {
            const err = new Error('Participant count does not match the selected trainer package');
            err.status = 400;
            throw err;
        }

        const participants = await repository.getUsersByEmails(trainerParticipantEmails);
        if (participants.length !== trainerParticipantEmails.length) {
            const foundEmails = new Set(participants.map((participant) => participant.email));
            const missingEmails = trainerParticipantEmails.filter((email) => !foundEmails.has(email));
            const err = new Error('Some participant emails are invalid or unregistered');
            err.status = 400;
            err.data = { missingEmails };
            throw err;
        }

        const invalidParticipants = participants.filter((participant) => !participant.is_verified || !participant.has_active_membership);
        if (invalidParticipants.length > 0) {
            const err = new Error('All participants must have an active membership');
            err.status = 403;
            err.data = { invalidEmails: invalidParticipants.map((participant) => participant.email) };
            throw err;
        }

        const conflicts = await repository.getActiveTrainerPackageConflicts(participants.map((participant) => participant.id));
        if (conflicts.length > 0) {
            const err = new Error('One or more participants already have an active trainer package');
            err.status = 409;
            err.data = { conflicts: conflicts.map((conflict) => conflict.email) };
            throw err;
        }
    }

    const accountTierCode = user.membership_price_code || 'UMUM';
    const basePrice = parseFloat(
        await repository.getPricingCatalogPrice(payload.transactionType, accountTierCode)
    );

    if (Number.isNaN(basePrice)) {
        throw new Error('Pricing option is missing a price');
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
                name: catalogItem.name
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
        accountTierCode,
        orderId,
        expireAt,
        paymentUrl,
        snapToken,
        penaltyAmount,
        trainerId,
        trainerParticipantEmails,
        trainerGroupSize: catalogItem.group_size || null
    });

    try {
        await queueOrderInvoiceEmail({
            to: user.email,
            name: user.full_name,
            orderId,
            paymentMethod: payload.paymentMethod,
            amount: grossAmount,
            penaltyAmount,
            itemName: catalogItem.name,
            expireAt,
            paymentUrl,
        });
    } catch (error) {
        console.error('Failed to send invoice email:', error.message || error);
    }

    sendTransactionNotification({
        userId,
        type: 'TRANSACTION_CREATED',
        itemName: catalogItem.name,
        amount: grossAmount
    });
	
    return transaction;
};

const getCashPayments = async () => {
    return await repository.getPendingCashTransactions();
};

const getTransactionHistory = async (userId, role, page, limit) => {
    const offset = (page - 1) * limit;
    const { rows, totalCount } = await repository.getTransactionsHistory({
        userId,
        isPengurus: role === 'pengurus',
        limit,
        offset
    });

    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        data: rows
    };
};

const getTransactionDetails = async (userId, role, transactionId) => {
    const transaction = role === 'pengurus'
        ? await repository.getTransactionById(transactionId)
        : await repository.getTransactionByIdForUser(transactionId, userId);

    if (!transaction) {
        const err = new Error('Transaction not found');
        err.status = 404;
        throw err;
    }

    return transaction;
};

const cancelTransaction = async (userId, role, transactionId) => {
    const transaction = role === 'pengurus'
        ? await repository.getTransactionById(transactionId)
        : await repository.getTransactionByIdForUser(transactionId, userId);

    if (!transaction) {
        const err = new Error('Transaction not found');
        err.status = 404;
        throw err;
    }

    if (transaction.status !== 'PENDING') {
        const err = new Error('Only pending transactions can be cancelled');
        err.status = 409;
        throw err;
    }

    if (transaction.payment_method === 'QRIS') {
        if (!transaction.order_id) {
            const err = new Error('Transaction order id is missing');
            err.status = 500;
            throw err;
        }

        try {
            await snap.transaction.cancel(transaction.order_id);
        } catch (error) {
            const parsedStatus = Number.parseInt(error?.httpStatusCode, 10);
            if (parsedStatus === 404 || error?.ApiResponse?.status_code === '404') {
                const err = new Error('You need to pick a payment method before canceling');
                err.status = 400;
                throw err;
            } else {
                const err = new Error('Failed to cancel Midtrans transaction');
                err.status = Number.isInteger(parsedStatus) ? parsedStatus : 502;
                err.data = error?.ApiResponse || null;
                throw err;
            }
        }
    }

    const result = await repository.processFailedPayment(transaction.id);

    sendTransactionNotification({
        userId,
        type: 'TRANSACTION_FAILED',
        itemName: transaction.catalog_name || 'Pesanan',
        amount: transaction.amount
    });

    return result;
};

const confirmCashPayment = async (transactionId, status) => {
    const transaction = await repository.getCashTransactionById(transactionId);
    
    if (!transaction) throw new Error('Transaction not found or not a cash payment');
    if (transaction.status !== 'PENDING') throw new Error('Transaction is already processed');

    if (status === 'SUCCESS') {
        await repository.processSuccessfulPayment(transaction);

        try {
            const user = await repository.getUserForTransaction(transaction.user_id);
            await queuePaymentReceiptEmail({
                to: user?.email,
                name: user?.full_name,
                orderId: transaction.order_id,
                paymentMethod: transaction.payment_method,
                amount: transaction.amount,
                penaltyAmount: transaction.penalty_amount,
                itemName: transaction.catalog_name,
                paidAt: new Date(),
            });
        } catch (error) {
            console.error('Failed to send receipt email:', error.message || error);
        }

        sendTransactionNotification({
            userId: transaction.user_id,
            type: 'TRANSACTION_SUCCESS',
            itemName: transaction.catalog_name,
            amount: transaction.amount
        });
    } else {
        await repository.processFailedPayment(transaction.id);

        sendTransactionNotification({
            userId: transaction.user_id,
            type: 'TRANSACTION_FAILED',
            itemName: transaction.catalog_name || 'Pesanan',
            amount: transaction.amount
        });
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

            try {
                const user = await repository.getUserForTransaction(transaction.user_id);
                await queuePaymentReceiptEmail({
                    to: user?.email,
                    name: user?.full_name,
                    orderId: transaction.order_id,
                    paymentMethod: transaction.payment_method,
                    amount: transaction.amount,
                    penaltyAmount: transaction.penalty_amount,
                    itemName: transaction.catalog_name,
                    paidAt: new Date(),
                });
            } catch (error) {
                console.error('Failed to send receipt email:', error.message || error);
            }

            sendTransactionNotification({
                userId: transaction.user_id,
                type: 'TRANSACTION_SUCCESS',
                itemName: transaction.catalog_name,
                amount: transaction.amount
            });
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

        sendTransactionNotification({
            userId: transaction.user_id,
            type: 'TRANSACTION_FAILED',
            itemName: transaction.catalog_name || 'Pesanan',
            amount: transaction.amount
        });

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
    getTransactionHistory,
    getTransactionDetails,
    cancelTransaction,
	confirmCashPayment,
	handleMidtransWebhook
};