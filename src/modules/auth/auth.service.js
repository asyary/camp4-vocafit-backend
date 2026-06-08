const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../../config/db');
const repository = require('./auth.repository');
const {
    queueVerificationEmail,
    queuePasswordResetOtpEmail,
} = require('../../utils/email-queue.util');
const { generateAccessToken, generateRefreshToken } = require('../../utils/jwt.util');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');

const CHALLENGE_TYPES = {
    EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
    PASSWORD_RESET: 'PASSWORD_RESET',
};

const TOKEN_TTL_MINUTES = 30;
const OTP_RETRY_DELAYS_MS = [2 * 60 * 1000, 5 * 60 * 1000];

const MEMBERSHIP_TIER_CODES = {
    UMUM: 'UMUM',
    PEGAWAI_KARYAWAN: 'PEGAWAI_KARYAWAN',
    MAHASISWA_NON_VOKASI: 'MAHASISWA_NON_VOKASI',
    MAHASISWA_VOKASI: 'MAHASISWA_VOKASI',
};

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

const generateOtpCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');

const getRetryDelayMs = (challenge) => {
    if (challenge?.next_resend_at) {
        const nextResendAt = new Date(challenge.next_resend_at);
        if (!Number.isNaN(nextResendAt.getTime())) {
            return Math.max(0, nextResendAt.getTime() - Date.now());
        }
    }

    if (challenge?.expires_at) {
        const expiresAt = new Date(challenge.expires_at);
        if (!Number.isNaN(expiresAt.getTime())) {
            return Math.max(0, expiresAt.getTime() - Date.now());
        }
    }

    return 0;
};

const getExpiryIso = (challenge) => {
    if (!challenge?.expires_at) return '-';
    const expiresAt = new Date(challenge.expires_at);
    if (Number.isNaN(expiresAt.getTime())) return '-';
    return expiresAt.toISOString();
};

const buildChallengePayload = (challengeType, challenge) => ({
    challenge_type: challengeType,
    expires_at: getExpiryIso(challenge),
    retry_in_ms: getRetryDelayMs(challenge),
});

const createServiceError = (message, status, data) => {
    const error = new Error(message);
    error.status = status;
    error.data = data;
    return error;
};

const determineMembershipTier = async (email) => {
    const normalizedEmail = String(email || '').toLowerCase();

    if (!normalizedEmail.endsWith('unesa.ac.id')) {
        return MEMBERSHIP_TIER_CODES.UMUM;
    }

    try {
		// Don't ask where I got this API endpoint from :D
        const response = await fetch(`https://sso.unesa.ac.id/api/profil/email/${email}`);
        const resData = await response.json();

        if (resData && resData.length > 0) {
            const data = resData[0];
            if (data.status === 'Mahasiswa') {
                if (data.namaparentunit === 'Fakultas Vokasi') {
                    return MEMBERSHIP_TIER_CODES.MAHASISWA_VOKASI;
                }

                return MEMBERSHIP_TIER_CODES.MAHASISWA_NON_VOKASI;
            }

            if (data.status !== 'Mahasiswa') {
                return MEMBERSHIP_TIER_CODES.PEGAWAI_KARYAWAN;
            }
        }
    } catch (error) {
        console.error('Failed to fetch Unesa API, falling back to default', error);
    }

    return MEMBERSHIP_TIER_CODES.UMUM;
};

const register = async (data, fileBuffer) => {
    const existingUser = await repository.findByEmail(data.email);
    const activeVerification = existingUser && !existingUser.is_verified
        ? await repository.getActiveChallenge(data.email, CHALLENGE_TYPES.EMAIL_VERIFICATION)
        : null;

    if (existingUser && (existingUser.is_verified || activeVerification)) {
        if (activeVerification) {
            throw createServiceError(
                'Verification email already sent.',
                409,
                buildChallengePayload(CHALLENGE_TYPES.EMAIL_VERIFICATION, activeVerification)
            );
        }
        throw new Error('Email already registered');
    }

    const verificationsToday = await repository.countChallengesCreatedToday(data.email, CHALLENGE_TYPES.EMAIL_VERIFICATION);
    if (verificationsToday >= 2 && (!existingUser || (!existingUser.is_verified && !activeVerification))) {
        throw new Error('Daily registration limit reached. Please try again tomorrow');
    }

    // Upload image to Cloudinary
    const profileImageUrl = await uploadToCloudinary(fileBuffer, 'users');

    const membershipPriceCode = await determineMembershipTier(data.email);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationToken = generateVerificationToken();
    const tokenHash = hashValue(verificationToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    const { user, challenge } = await db.withTransaction(async (client) => {
        const savedUser = existingUser
            ? await repository.updateUnverifiedUser({
                ...data,
                passwordHash,
                membershipPriceCode,
                profileImageUrl
            }, client)
            : await repository.createUser({
                ...data,
                passwordHash,
                membershipPriceCode,
                profileImageUrl
            }, client);

        const savedChallenge = await repository.createChallenge({
            email: data.email,
            userId: savedUser.id,
            challengeType: CHALLENGE_TYPES.EMAIL_VERIFICATION,
            tokenHash,
            expiresAt,
        }, client);

        return { user: savedUser, challenge: savedChallenge };
    });

    await queueVerificationEmail(user.email, user.full_name, verificationToken);
    return { user, challenge };
};

const login = async (data) => {
    const user = await repository.findByEmail(data.email);
    if (!user) throw new Error('Invalid credentials');

    if (!user.is_verified) {
        const activeVerification = await repository.getActiveChallenge(data.email, CHALLENGE_TYPES.EMAIL_VERIFICATION);
        if (activeVerification) {
            throw new Error('Verification is still active. Please check your email.');
        }

        throw new Error('Account is inactive');
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) throw new Error('Invalid credentials');

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            name: user.full_name,
            role: user.role,
            tier: user.tier,
            membership: user.membership,
        },
    };
};

const verifyUser = async (token) => {
    const tokenHash = hashValue(token);
    const challenge = await repository.getVerificationChallengeByTokenHash(tokenHash);

    if (!challenge) return null;

    const verifiedUser = await db.withTransaction(async (client) => {
        const updatedUser = await repository.markUserVerified(challenge.email, client);
        if (!updatedUser) return null;

        await repository.consumeChallenge(challenge.id, client);
        return updatedUser;
    });

    if (!verifiedUser) return null;

    const accessToken = generateAccessToken(verifiedUser.id, verifiedUser.role);
    const refreshToken = generateRefreshToken(verifiedUser.id);

    return {
        accessToken,
        refreshToken,
        user: {
            id: verifiedUser.id,
            name: verifiedUser.full_name,
            role: verifiedUser.role,
            tier: verifiedUser.tier,
            membership: verifiedUser.membership,
        },
    };
};

const requestPasswordReset = async (email) => {
    const user = await repository.findByEmail(email);
    if (!user || !user.is_verified) {
        return true;
    }

    const activeChallenge = await repository.getActiveChallenge(email, CHALLENGE_TYPES.PASSWORD_RESET);
    if (activeChallenge) {
        return true;
    }

    const requestCount = await repository.countChallengesCreatedToday(email, CHALLENGE_TYPES.PASSWORD_RESET);
    if (requestCount >= 3) {
        throw new Error('Password reset request limit reached for today');
    }

    const otp = generateOtpCode();
    const otpHash = hashValue(`${email}:${otp}`);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await repository.createChallenge({
        email,
        userId: user.id,
        challengeType: CHALLENGE_TYPES.PASSWORD_RESET,
        otpHash,
        expiresAt,
        nextResendAt: new Date(Date.now() + OTP_RETRY_DELAYS_MS[0]),
    });

    await queuePasswordResetOtpEmail(user.email, user.full_name, otp);
    return true;
};

const resendPasswordResetOtp = async (email) => {
    const user = await repository.findByEmail(email);
    if (!user || !user.is_verified) {
        return true;
    }
	
	const challenge = await repository.getActiveChallenge(email, CHALLENGE_TYPES.PASSWORD_RESET);
    if (!challenge) {
        return true;
    }

    if (challenge.resend_count >= 2) {
        throw new Error('OTP resend limit reached');
    }

    if (challenge.next_resend_at && new Date(challenge.next_resend_at) > new Date()) {
        throw new Error('Please wait before requesting the OTP again');
    }

    const otp = generateOtpCode();
    const otpHash = hashValue(`${email}:${otp}`);
    const nextResendAt = new Date(Date.now() + OTP_RETRY_DELAYS_MS[Math.min(challenge.resend_count + 1, 1)]);

    await repository.updatePasswordResetOtp(challenge.id, otpHash, nextResendAt);
    await queuePasswordResetOtpEmail(user.email, user.full_name, otp);
    return true;
};

const resetPassword = async (email, otp, newPassword) => {
    const challenge = await repository.getActiveChallenge(email, CHALLENGE_TYPES.PASSWORD_RESET);
    if (!challenge) throw new Error('Invalid or expired OTP');

    if (challenge.attempt_count >= 3) {
        await repository.expireChallenge(challenge.id);
        throw new Error('OTP attempt limit reached');
    }

    const otpHash = hashValue(`${email}:${otp}`);
    const validOtp = challenge.otp_hash === otpHash;

    if (!validOtp) {
        const updatedChallenge = await repository.incrementChallengeAttempt(challenge.id);
        if (updatedChallenge.attempt_count >= 3) {
            await repository.expireChallenge(challenge.id);
        }
        throw new Error('Invalid or expired OTP');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.withTransaction(async (client) => {
        await repository.updatePasswordHashByEmail(email, passwordHash, client);
        await repository.consumeChallenge(challenge.id, client);
    });
    return true;
};

module.exports = {
    register,
    login,
    verifyUser,
    requestPasswordReset,
    resendPasswordResetOtp,
    resetPassword,
};