const cron = require('node-cron');
const authRepository = require('../modules/auth/auth.repository');

const initAuthCronJobs = () => {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const expiredCount = await authRepository.expireStaleChallenges();
            if (expiredCount > 0) {
                console.log(`[CRON] Expired ${expiredCount} stale auth challenge(s).`);
            }
        } catch (error) {
            console.error('[CRON] Error expiring auth challenges:', error);
        }
    });
};

module.exports = { initAuthCronJobs };