require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { xss } = require('express-xss-sanitizer');

const authRoutes = require('./modules/auth/auth.routes');
const transactionRoutes = require('./modules/transactions/transaction.routes');
const visitRoutes = require('./modules/gym_visits/visit.routes');
const newsRoutes = require('./modules/pengurus/news.routes');
const trainerRoutes = require('./modules/pengurus/trainer.routes');
const pengurusRoutes = require('./modules/pengurus/pengurus.routes');
const activityRoutes = require('./modules/activities/activity.routes');
const userRoutes = require('./modules/users/user.routes');
const { initCronJobs } = require('./cron/penalty.cron');

const app = express();

initCronJobs();

const parseAllowedOrigins = () => {
    const fromList = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (fromList.length > 0) return fromList;
    if (process.env.CLIENT_URL) return [process.env.CLIENT_URL.trim()];
    return [];
};

const allowedOrigins = parseAllowedOrigins();

// Middlewares
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser clients (Postman, server-to-server)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
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
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
