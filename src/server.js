require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { xss } = require('express-xss-sanitizer');
const { ZodError } = require('zod');

const authRoutes = require('./modules/auth/auth.routes');
const transactionRoutes = require('./modules/transactions/transaction.routes');
const visitRoutes = require('./modules/gym_visits/visit.routes');
const newsRoutes = require('./modules/pengurus/news.routes');
const trainerRoutes = require('./modules/pengurus/trainer.routes');
const pengurusRoutes = require('./modules/pengurus/pengurus.routes');
const activityRoutes = require('./modules/activities/activity.routes');
const userRoutes = require('./modules/users/user.routes');
const { initCronJobs } = require('./cron/penalty.cron');
const responseHandler = require('./middlewares/response.middleware');

const app = express();
app.use(responseHandler);

initCronJobs();

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
app.use('/api/visits', visitRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/admin', pengurusRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/users', userRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
	if (err instanceof ZodError) {
		return res.error('Validation Error', 400, err.flatten().fieldErrors);
	}

	// Handle other types of errors
	res.error(err.message || 'Internal Server Error', err.status || 500, err.data || null);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});