const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendVerificationEmail = async (to, token) => {
    const backendUrl = process.env.SERVER_URL || 'http://localhost:8080';
    const link = `${backendUrl}/api/auth/verify-email/${token}`;
    await transporter.sendMail({
        from: '"Vocafit" <no-reply@vocafit.id>',
        to,
        subject: 'Verify your Vocafit Account',
        html: `<p>Click <a href="${link}">here</a> to verify your account.</p>`
    });
};

module.exports = { sendVerificationEmail };
