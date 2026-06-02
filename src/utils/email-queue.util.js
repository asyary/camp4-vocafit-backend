const crypto = require('crypto');
const redisClient = require('../config/redis');
const {
    sendVerificationEmail,
    sendPasswordResetOtpEmail,
    sendOrderInvoiceEmail,
    sendPaymentReceiptEmail,
} = require('./email.util');

const EMAIL_QUEUE_KEY = 'email:queue';
const EMAIL_QUEUE_PROCESSING_KEY = `${EMAIL_QUEUE_KEY}:processing`;
const EMAIL_QUEUE_MAX_ATTEMPTS = 3;
const EMAIL_QUEUE_RETRY_DELAY_MS = 2000;

const EMAIL_JOB_HANDLERS = {
    verification: (payload) => sendVerificationEmail(payload.to, payload.name, payload.token),
    password_reset_otp: (payload) => sendPasswordResetOtpEmail(payload.to, payload.name, payload.otp),
    order_invoice: (payload) => sendOrderInvoiceEmail(payload),
    payment_receipt: (payload) => sendPaymentReceiptEmail(payload),
};

let workerStarted = false;
let workerRedisClient = null;

const createJob = (type, payload, options = {}) => ({
    id: crypto.randomBytes(16).toString('hex'),
    type,
    payload,
    attempts: 0,
    maxAttempts: Number.isInteger(options.maxAttempts) ? options.maxAttempts : EMAIL_QUEUE_MAX_ATTEMPTS,
    createdAt: new Date().toISOString(),
});

const enqueueEmail = async (type, payload, options) => {
    const job = createJob(type, payload, options);
    await redisClient.rPush(EMAIL_QUEUE_KEY, JSON.stringify(job));
    return job.id;
};

const queueVerificationEmail = (to, name, token) => enqueueEmail('verification', { to, name, token });
const queuePasswordResetOtpEmail = (to, name, otp) => enqueueEmail('password_reset_otp', { to, name, otp });
const queueOrderInvoiceEmail = (payload) => enqueueEmail('order_invoice', payload);
const queuePaymentReceiptEmail = (payload) => enqueueEmail('payment_receipt', payload);

const requeueProcessingJobs = async () => {
    const pendingJobs = await redisClient.lRange(EMAIL_QUEUE_PROCESSING_KEY, 0, -1);
    if (!pendingJobs.length) return;

    await redisClient.del(EMAIL_QUEUE_PROCESSING_KEY);
    await redisClient.rPush(EMAIL_QUEUE_KEY, pendingJobs);
};

const requeueWithDelay = (job) => {
    const delayMs = EMAIL_QUEUE_RETRY_DELAY_MS * Math.max(job.attempts, 1);
    setTimeout(() => {
        redisClient.rPush(EMAIL_QUEUE_KEY, JSON.stringify(job)).catch((error) => {
            console.error('Failed to requeue email job', job.id, error);
        });
    }, delayMs);
};

const handleJobFailure = async (job, jobPayload, error, workerClient) => {
    const nextAttempt = job.attempts + 1;
    await workerClient.lRem(EMAIL_QUEUE_PROCESSING_KEY, 1, jobPayload);

    if (nextAttempt >= job.maxAttempts) {
        console.error('Email job failed permanently', job.id, error);
        return;
    }

    const updatedJob = {
        ...job,
        attempts: nextAttempt,
        lastError: error?.message || String(error),
        updatedAt: new Date().toISOString(),
    };

    requeueWithDelay(updatedJob);
};

const processEmailJob = async (jobPayload, workerClient) => {
    let job;

    try {
        job = JSON.parse(jobPayload);
    } catch (error) {
        await workerClient.lRem(EMAIL_QUEUE_PROCESSING_KEY, 1, jobPayload);
        console.error('Failed to parse email job payload', error);
        return;
    }

    const handler = EMAIL_JOB_HANDLERS[job.type];
    if (!handler) {
        await workerClient.lRem(EMAIL_QUEUE_PROCESSING_KEY, 1, jobPayload);
        console.error('Unknown email job type', job.type);
        return;
    }

    try {
        await handler(job.payload);
        await workerClient.lRem(EMAIL_QUEUE_PROCESSING_KEY, 1, jobPayload);
    } catch (error) {
        await handleJobFailure(job, jobPayload, error, workerClient);
    }
};

const startEmailQueueWorker = async ({ concurrency = 1 } = {}) => {
    if (workerStarted) return;
    workerStarted = true;

    workerRedisClient = redisClient.duplicate();
    await workerRedisClient.connect();

    await requeueProcessingJobs();

    for (let index = 0; index < concurrency; index += 1) {
        (async () => {
            while (true) {
                const jobPayload = await workerRedisClient.brPopLPush(
                    EMAIL_QUEUE_KEY,
                    EMAIL_QUEUE_PROCESSING_KEY,
                    0
                );

                if (!jobPayload) continue;
                await processEmailJob(jobPayload, workerRedisClient);
            }
        })().catch((error) => {
            console.error('Email worker crashed', error);
        });
    }
};

module.exports = {
    enqueueEmail,
    queueVerificationEmail,
    queuePasswordResetOtpEmail,
    queueOrderInvoiceEmail,
    queuePaymentReceiptEmail,
    startEmailQueueWorker,
};
