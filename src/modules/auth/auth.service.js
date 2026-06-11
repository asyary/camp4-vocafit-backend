const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../../config/db');
const repository = require('./auth.repository');
const { queueVerificationEmail, queuePasswordResetOtpEmail } = require('../../utils/email-queue.util');
const { generateAccessToken, generateRefreshToken, verifyAccessToken } = require('../../utils/jwt.util');
const { uploadToCloudinary } = require('../../utils/cloudinary.util');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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

const resolveLocation = async (ipAddress) => {
    try {
        if (!ipAddress) return { city: 'Unknown', country: 'Unknown' };

        let cleanIp = ipAddress.split(',')[0].trim();
        if (cleanIp.startsWith('::ffff:')) {
            cleanIp = cleanIp.replace('::ffff:', '');
        }

        if (cleanIp === '127.0.0.1' || cleanIp === '::1') return { city: 'localhost', country: 'localhost' };

        const response = await fetch(`http://ip-api.com/json/${cleanIp}`);
        const data = await response.json();
        if (data.status === 'success') {
            return { city: data.city, country: data.country };
        }
    } catch (err) {
        console.error('Failed to resolve IP location', err);
    }
    return { city: 'Unknown', country: 'Unknown' };
};

const getDeviceType = (userAgent) => {
    if (!userAgent) return 'Unknown';
    return /mobile|android|iphone|ipad|phone/i.test(userAgent) ? 'Mobile' : 'Desktop';
};

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
    error_code: challengeType,
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
                profileImageUrl,
                phoneNumber: data.phoneNumber,
                birthDate: data.birthDate
            }, client)
            : await repository.createUser({
                ...data,
                passwordHash,
                membershipPriceCode,
                profileImageUrl,
                phoneNumber: data.phoneNumber,
                birthDate: data.birthDate
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
    return true;
};

const login = async (data, ipAddress, userAgent) => {
    const recentFails = await repository.getRecentFailedLogins(data.email, ipAddress);
    if (recentFails.length >= 3) {
        const lastFailedAt = new Date(recentFails[0].created_at).getTime();
        const threeMinutesInMs = 3 * 60 * 1000;
        const timeSinceLastFailure = Date.now() - lastFailedAt;
        if (timeSinceLastFailure < threeMinutesInMs) {
            throw createServiceError('Too many failed login attempts. Please try again later.', 429, {
                challenge_type: 'LOGIN_COOLDOWN',
                expires_at: new Date(lastFailedAt + threeMinutesInMs).toISOString(),
                retry_in_ms: threeMinutesInMs - timeSinceLastFailure
            });
        }
    }

    const user = await repository.findByEmail(data.email);
    if (!user) {
        await repository.createAuthLog({ userId: null, email: data.email, ipAddress, userAgent, isSuccess: false, reason: 'User not found' });
        
        if (recentFails.length + 1 >= 3) {
            throw createServiceError('Too many failed login attempts. Please try again later.', 429, {
                challenge_type: 'LOGIN_COOLDOWN',
                expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
                retry_in_ms: 3 * 60 * 1000
            });
        }
        throw new Error('Invalid credentials');
    }

    if (!user.is_verified) {
        const activeVerification = await repository.getActiveChallenge(data.email, CHALLENGE_TYPES.EMAIL_VERIFICATION);
        await repository.createAuthLog({ userId: user.id, email: data.email, ipAddress, userAgent, isSuccess: false, reason: 'Account not verified' });
        if (activeVerification) {
            throw createServiceError(
                'Verification is still active. Please check your email.',
                403,
                buildChallengePayload(CHALLENGE_TYPES.EMAIL_VERIFICATION, activeVerification)
            );
        }

        throw new Error('Account is inactive');
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
        await repository.createAuthLog({ userId: user.id, email: data.email, ipAddress, userAgent, isSuccess: false, reason: 'Invalid password' });
        
        if (recentFails.length + 1 >= 3) {
            throw createServiceError('Too many failed login attempts. Please try again later.', 429, {
                challenge_type: 'LOGIN_COOLDOWN',
                expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
                retry_in_ms: 3 * 60 * 1000
            });
        }
        throw new Error('Invalid credentials');
    }
    
    await repository.createAuthLog({ userId: user.id, email: data.email, ipAddress, userAgent, isSuccess: true, reason: 'Success' });

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(user.id, user.role, sessionId);
    const refreshToken = generateRefreshToken(user.id, sessionId);
    const refreshTokenHash = hashValue(refreshToken);

    const { city, country } = await resolveLocation(ipAddress);
    const deviceType = getDeviceType(userAgent);

    await repository.createUserSession({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        city,
        country,
        deviceType,
        userAgent
    });

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

const verifyUser = async (token, ipAddress, userAgent) => {
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

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(verifiedUser.id, verifiedUser.role, sessionId);
    const refreshToken = generateRefreshToken(verifiedUser.id, sessionId);
    const refreshTokenHash = hashValue(refreshToken);

    const { city, country } = await resolveLocation(ipAddress);
    const deviceType = getDeviceType(userAgent);

    await repository.createUserSession({
        id: sessionId,
        userId: verifiedUser.id,
        refreshTokenHash,
        ipAddress,
        city,
        country,
        deviceType,
        userAgent
    });

    await repository.createAuthLog({ userId: verifiedUser.id, email: verifiedUser.email, ipAddress, userAgent, isSuccess: true, reason: 'Email Verification Login' });

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
        throw createServiceError(
            'Please wait before requesting the OTP again',
            429,
            buildChallengePayload(CHALLENGE_TYPES.PASSWORD_RESET, challenge)
        );
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
        await repository.invalidateAllUserSessions(challenge.user_id, client);
    });
    return true;
};

const verifyOtp = async (email, otp) => {
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

    return true;
};

const resendVerificationEmail = async (email) => {
    const user = await repository.findByEmail(email);
    if (!user || user.is_verified) {
        return true;
    }
	
    let challenge = await repository.getActiveChallenge(email, CHALLENGE_TYPES.EMAIL_VERIFICATION);
    if (!challenge) {
        const verificationsToday = await repository.countChallengesCreatedToday(email, CHALLENGE_TYPES.EMAIL_VERIFICATION);
        if (verificationsToday >= 2) {
            throw new Error('Daily verification limit reached. Please try again tomorrow.');
        }

        const verificationToken = generateVerificationToken();
        const tokenHash = hashValue(verificationToken);
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

        await repository.createChallenge({
            email: user.email,
            userId: user.id,
            challengeType: CHALLENGE_TYPES.EMAIL_VERIFICATION,
            tokenHash,
            expiresAt,
            nextResendAt: null,
        });

        await queueVerificationEmail(user.email, user.full_name, verificationToken);
        return true;
    }

    if (challenge.resend_count >= 2) {
        throw new Error('Verification resend limit reached. Please wait until the current verification expires.');
    }

    if (challenge.next_resend_at && new Date(challenge.next_resend_at) > new Date()) {
        throw createServiceError(
            'Please wait before requesting the verification email again.',
            429,
            buildChallengePayload(CHALLENGE_TYPES.EMAIL_VERIFICATION, challenge)
        );
    }

    const verificationToken = generateVerificationToken();
    const tokenHash = hashValue(verificationToken);
    
    // First resend (resend_count = 0) can be done immediately, next one needs to wait 5 minutes
    const nextResendAt = new Date(Date.now() + 5 * 60 * 1000); 

    await repository.updateVerificationChallenge(challenge.id, tokenHash, nextResendAt);
    await queueVerificationEmail(user.email, user.full_name, verificationToken);
    return true;
};

const logout = async (token) => {
    if (!token) return;
    try {
        const decoded = verifyAccessToken(token);
        if (decoded.sessionId) {
            await repository.invalidateSession(decoded.sessionId);
        }
    } catch (err) {
        // Ignore invalid tokens on logout
    }
};

const verifyGoogleToken = async (token) => {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        return ticket.getPayload();
    } catch (err) {
        throw createServiceError('Invalid Google token', 400);
    }
};

const registerGoogle = async (data, fileBuffer, ipAddress, userAgent) => {
    const payload = await verifyGoogleToken(data.googleToken);
    const email = payload.email;
    const defaultPicture = payload.picture;
    const googleId = payload.sub;

    const existingUser = await repository.findByEmail(email);
    const activeVerification = existingUser && !existingUser.is_verified
        ? await repository.getActiveChallenge(email, CHALLENGE_TYPES.EMAIL_VERIFICATION)
        : null;

    if (existingUser && existingUser.is_verified) {
        throw new Error('Email already registered. Please log in instead.');
    }

    let profileImageUrl = defaultPicture;

    if (fileBuffer) {
        profileImageUrl = await uploadToCloudinary(fileBuffer, 'users');
    } else {
        const imageUrlToFetch = defaultPicture || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(data.fullName) + '&background=random');
        try {
            const response = await fetch(imageUrlToFetch);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            profileImageUrl = await uploadToCloudinary(buffer, 'users');
        } catch (error) {
			throw new Error('Failed to process profile image');
        }
    }

    const membershipPriceCode = await determineMembershipTier(email);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await db.withTransaction(async (client) => {
        const savedUser = existingUser
            ? await repository.updateUnverifiedUser({
                email,
                passwordHash,
                fullName: data.fullName,
                membershipPriceCode,
                profileImageUrl,
                phoneNumber: data.phoneNumber,
                birthDate: data.birthDate,
                isVerified: true,
                googleId
            }, client)
            : await repository.createUser({
                email,
                passwordHash,
                fullName: data.fullName,
                membershipPriceCode,
                profileImageUrl,
                phoneNumber: data.phoneNumber,
                birthDate: data.birthDate,
                isVerified: true,
                googleId
            }, client);

        if (activeVerification) {
            await repository.consumeChallenge(activeVerification.id, client);
        }

        return savedUser;
    });

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(user.id, user.role, sessionId);
    const refreshToken = generateRefreshToken(user.id, sessionId);
    const refreshTokenHash = hashValue(refreshToken);

    const { city, country } = await resolveLocation(ipAddress);
    const deviceType = getDeviceType(userAgent);

    await repository.createUserSession({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        city,
        country,
        deviceType,
        userAgent
    });

    await repository.createAuthLog({ userId: user.id, email: user.email, ipAddress, userAgent, isSuccess: true, reason: 'Google Registration' });

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

const loginGoogle = async (data, ipAddress, userAgent) => {
    const payload = await verifyGoogleToken(data.googleToken);
    const email = payload.email;
    const googleId = payload.sub;

    let user = await repository.findByEmail(email);
    if (!user) {
        await repository.createAuthLog({ userId: null, email, ipAddress, userAgent, isSuccess: false, reason: 'User not found for Google Login' });
        throw createServiceError('Account not found. Please register first.', 404);
    }

    user = await db.withTransaction(async (client) => {
        return await repository.linkGoogleAccount(email, googleId, client);
    });

    await repository.createAuthLog({ userId: user.id, email, ipAddress, userAgent, isSuccess: true, reason: 'Google Login Success' });

    const sessionId = crypto.randomUUID();
    const accessToken = generateAccessToken(user.id, user.role, sessionId);
    const refreshToken = generateRefreshToken(user.id, sessionId);
    const refreshTokenHash = hashValue(refreshToken);

    const { city, country } = await resolveLocation(ipAddress);
    const deviceType = getDeviceType(userAgent);

    await repository.createUserSession({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        city,
        country,
        deviceType,
        userAgent
    });

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

module.exports = {
    register,
    login,
    logout,
    verifyUser,
    requestPasswordReset,
    resendPasswordResetOtp,
    resetPassword,
    verifyOtp,
    resendVerificationEmail,
    registerGoogle,
    loginGoogle,
};