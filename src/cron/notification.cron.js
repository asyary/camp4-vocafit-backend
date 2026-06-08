const cron = require('node-cron');
const {
    sendMembershipExpiryReminders,
    sendSessionReminders,
    purgeExpiredNotifications
} = require('../modules/notifications/notifications.service');

const initNotificationCronJobs = () => {
    // Run at 6:00 AM every day — send membership expiry + session reminders
    cron.schedule('0 6 * * *', async () => {
        console.log('[CRON] Starting 6 AM notification reminders...');
        try {
            const expiryResult = await sendMembershipExpiryReminders();
            console.log(
                `[CRON] Membership expiry reminders sent — today: ${expiryResult.endingToday}, tomorrow: ${expiryResult.endingTomorrow}`
            );
        } catch (error) {
            console.error('[CRON] Error sending membership expiry reminders:', error);
        }

        try {
            const sessionCount = await sendSessionReminders();
            console.log(`[CRON] Session reminders sent to ${sessionCount} user(s).`);
        } catch (error) {
            console.error('[CRON] Error sending session reminders:', error);
        }
    });

    // Run at 3:00 AM every day — purge expired notifications (older than 30 days)
    cron.schedule('0 3 * * *', async () => {
        console.log('[CRON] Starting notification cleanup...');
        try {
            const deleted = await purgeExpiredNotifications();
            console.log(`[CRON] Purged ${deleted} expired notification(s).`);
        } catch (error) {
            console.error('[CRON] Error purging expired notifications:', error);
        }
    });
};

module.exports = { initNotificationCronJobs };
