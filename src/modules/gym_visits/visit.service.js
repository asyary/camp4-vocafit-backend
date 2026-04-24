const crypto = require('crypto');
const redisClient = require('../../config/redis');
const repository = require('./visit.repository');

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

	// Needed?
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour >= 21) {
        throw new Error('Gym is currently closed. Operating hours are 6 AM to 9 PM.');
    }

    const activeVisit = await repository.getActiveVisit(userId);

    let resultMessage = '';
    let action = '';

    if (activeVisit) {
        // If user is already inside, this is tap-out
        await repository.updateTapOut(activeVisit.id);
        resultMessage = 'Tap-out successful. Have a great day!';
        action = 'TAP_OUT';
    } else {
		// If user is not inside, this is tap-in
        await repository.createTapIn(userId, qrToken);
        resultMessage = 'Tap-in successful. Welcome to Vocafit!';
        action = 'TAP_IN';
    }

    // Invalidate the QR token immediately after successful use
    await redisClient.del(redisKey);

    return { action, message: resultMessage, userId };
};

const getCrowdMeter = async () => {
    const count = await repository.getCrowdCount();
    return { 
        count,
        status: count > 20 ? 'Busy' : count > 10 ? 'Moderate' : 'Quiet'
    };
};

module.exports = { generateQrToken, processScan, getCrowdMeter };