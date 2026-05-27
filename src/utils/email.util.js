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

const sendVerificationEmail = async (to, name, token) => {
    const link = `${process.env.CLIENT_URL}/verify-email/${token}`;
    await transporter.sendMail({
        from: '"Vocafit" <no-reply@vocafit.id>',
        to,
        subject: 'Verify Your Vocafit Account',
        html: `<p>Hi, ${name}.</p><p>Click <a href="${link}">here</a> to verify your Vocafit account.</p><p>This verification link expires in 30 minutes.</p>`
    });
};

const sendPasswordResetOtpEmail = async (to, name, otp) => {
    await transporter.sendMail({
        from: '"Vocafit" <no-reply@vocafit.id>',
        to,
        subject: 'Your Vocafit Password Reset OTP',
        html: `<p>Hi, ${name}.</p><p>Your password reset OTP is <strong>${otp}</strong>.</p><p>This code expires in 30 minutes. If you did not request this, you can ignore this email.</p>`
    });
};

module.exports = { sendVerificationEmail, sendPasswordResetOtpEmail };