require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const http = require('http');
const { xss } = require('express-xss-sanitizer');
const { ZodError } = require('zod');
const { initDevAdmin } = require('./utils/dev-admin.util');

const authRoutes = require('./modules/auth/auth.routes');
const transactionRoutes = require('./modules/transactions/transaction.routes');
const catalogRoutes = require('./modules/catalogs/catalog.routes');
const visitRoutes = require('./modules/gym_visits/visit.routes');
const newsRoutes = require('./modules/news/news.routes');
const trainerRoutes = require('./modules/trainers/trainer.routes');
const pengurusRoutes = require('./modules/pengurus/pengurus.routes');
const activityRoutes = require('./modules/activities/activity.routes');
const userRoutes = require('./modules/users/user.routes');
const { initCronJobs } = require('./cron/penalty.cron');
const { initAuthCronJobs } = require('./cron/auth.cron');
const { initTransactionCronJobs } = require('./cron/transaction.cron');
const { initTrainerPackageCronJobs } = require('./cron/trainer_package.cron');
const responseHandler = require('./middlewares/response.middleware');
const { initSocket } = require('./config/socket');
const { startEmailQueueWorker } = require('./utils/email-queue.util');

const app = express();
const server = http.createServer(app);

app.use(responseHandler);

initCronJobs();
initAuthCronJobs();
initTransactionCronJobs();
initTrainerPackageCronJobs();
startEmailQueueWorker().catch((error) => {
    console.error('Failed to start email queue worker', error);
});
initDevAdmin().catch((error) => {
	console.warn('Failed to ensure dev admin user', error);
});

// Middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(xss());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/admin', pengurusRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/users', userRoutes);

// WebSocket init
initSocket(server);

// Global Error Handler
app.use((err, req, res, next) => {
	if (err instanceof ZodError) {
		return res.error('Validation Error', 400, err.flatten().fieldErrors);
	}

	// Handle other types of errors
	res.error(err.message || 'Internal Server Error', err.status || 500, err.data || null);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});