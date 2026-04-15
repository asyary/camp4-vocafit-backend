const cron = require('node-cron');
const { applyPenaltyAndAutoTapOut } = require('../modules/gym_visits/visit.repository');

const initCronJobs = () => {
    // Run at 21:03 (9:03 PM) every day
    cron.schedule('3 21 * * *', async () => {
        console.log('[CRON] Starting 9 PM penalty check...');
        try {
            const penalizedCount = await applyPenaltyAndAutoTapOut();
            console.log(`[CRON] Penalty check complete. Penalized ${penalizedCount} users.`);
        } catch (error) {
            console.error('[CRON] Error during penalty check:', error);
        }
    });
};

module.exports = { initCronJobs };