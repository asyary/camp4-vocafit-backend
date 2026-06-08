const cron = require('node-cron');
const trainerPackageRepository = require('../modules/trainers/trainer.repository');

const initTrainerPackageCronJobs = () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            const expiredCount = await trainerPackageRepository.expireTrainerPackages();
            if (expiredCount > 0) {
                console.log(`[CRON] Expired ${expiredCount} trainer package(s).`);
            }
        } catch (error) {
            console.error('[CRON] Error expiring trainer packages:', error);
        }
    });
};

module.exports = { initTrainerPackageCronJobs };