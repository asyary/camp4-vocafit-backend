const cron = require('node-cron');
const transactionRepository = require('../modules/transactions/transaction.repository');

const initTransactionCronJobs = () => {
    cron.schedule('*/3 * * * *', async () => {
        try {
            const expiredCount = await transactionRepository.expireStaleTransactions();
            if (expiredCount > 0) {
                console.log(`[CRON] Expired ${expiredCount} stale transaction(s).`);
            }
        } catch (error) {
            console.error('[CRON] Error expiring stale transactions:', error);
        }
    });
};

module.exports = { initTransactionCronJobs };
