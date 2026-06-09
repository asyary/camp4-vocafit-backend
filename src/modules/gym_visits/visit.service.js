const crypto = require('crypto');
const redisClient = require('../../config/redis');
const repository = require('./visit.repository');
const visitSocket = require('./visit.socket');
const crowdSocket = require('./crowd.socket');
const { withProfileImageThumb } = require('../../utils/image.util');

const generateQrToken = async (userId) => {
    const qrToken = crypto.randomUUID();
    const redisKey = `qr:${qrToken}`;
    
    // Store in Redis with 5 minutes TTL
    await redisClient.set(redisKey, userId, { EX: 300 });
    
    return qrToken;
};

const processScan = async (qrToken, iotSecret) => {
    const redisKey = `qr:${qrToken}`;
    const userId = await redisClient.get(redisKey);

    if (iotSecret !== process.env.IOT_SECRET_KEY) {
        throw new Error('Invalid or missing IoT secret key.');
    } else if (!userId) {
        throw new Error('Invalid or expired QR code.');
    }

    // Allow visits from 06:00, grace period until 21:04
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const beforeOpen = currentHour < 6;
    const afterClose = currentHour > 21 || (currentHour === 21 && currentMinute >= 5);

    if (beforeOpen || afterClose) {
        throw new Error('Gym is currently closed. Operating hours are 6:00 to 21:04.');
    }

    const activeVisit = await repository.getActiveVisit(userId);
	const userDetails = await repository.getUserDetailsForSocket(userId);

    let resultMessage = '';
    let action = '';

    if (activeVisit) {
        // If user is already inside, this is tap-out
        await repository.updateTapOut(activeVisit.id);
        resultMessage = 'Tap-out successful. Have a great day!';
        action = 'TAP_OUT';

		visitSocket.emitVisitActivity({
            action: 'TAP_OUT',
            user: withProfileImageThumb(userDetails),
            time: new Date(),
            emittedFrom: 'visit.service.processScan'
        });
    } else {
		// If user is not inside, this is tap-in
        await repository.createTapIn(userId, qrToken);
        resultMessage = 'Tap-in successful. Welcome to Vocafit!';
        action = 'TAP_IN';

		visitSocket.emitVisitActivity({
            action: 'TAP_IN',
            user: withProfileImageThumb(userDetails),
            time: new Date(),
            emittedFrom: 'visit.service.processScan'
        });
    }

    // Invalidate the QR token immediately after successful use
    await redisClient.del(redisKey);

    const crowdMeter = await getCrowdMeter();
    crowdSocket.emitCrowdUpdate({
        count: crowdMeter.count,
        status: crowdMeter.status,
        emittedFrom: 'visit.service.processScan'
    });

    return { action, message: resultMessage, userId };
};

const getCrowdMeter = async () => {
    const count = await repository.getCrowdCount();
    return { 
        count,
        status: count > 20 ? 'Busy' : count > 10 ? 'Moderate' : 'Quiet'
    };
};

const getMyVisitHistory = async (userId, query) => {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const [history, totalCount] = await Promise.all([
        repository.getVisitHistory(userId, limit, offset),
        repository.countUserVisits(userId)
    ]);

    return {
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        data: history
    };
};

const getMyVisitStatus = async (userId) => {
    const activeVisit = await repository.getActiveVisit(userId);
    
    if (activeVisit) {
        return { status: 'INSIDE', tapInTime: activeVisit.tap_in_time };
    } else {
        return { status: 'OUTSIDE' };
    }
};

module.exports = { generateQrToken, processScan, getCrowdMeter, getMyVisitHistory, getMyVisitStatus };