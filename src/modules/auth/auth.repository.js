const db = require('../../config/db');

const queryWith = (executor, text, params) => executor.query(text, params);

const findByEmail = async (email) => {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
};

const createUser = async (userData, executor = db) => {
    const { email, passwordHash, fullName, monthlyPrice, profileImageUrl } = userData;
    const { rows } = await queryWith(
        executor,
        `INSERT INTO users (email, password_hash, full_name, monthly_price, profile_image_url) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, is_verified, verified_at`,
        [email, passwordHash, fullName, monthlyPrice, profileImageUrl]
    );
    return rows[0];
};

const updateUnverifiedUser = async (userData, executor = db) => {
    const { email, passwordHash, fullName, monthlyPrice, profileImageUrl } = userData;
    const { rows } = await queryWith(
        executor,
        `UPDATE users 
         SET password_hash = $2,
             full_name = $3,
             monthly_price = $4,
             profile_image_url = $5,
             updated_at = NOW()
         WHERE email = $1 AND is_verified = FALSE
         RETURNING id, email, full_name, role, is_verified, verified_at`,
        [email, passwordHash, fullName, monthlyPrice, profileImageUrl]
    );
    return rows[0];
};

const markUserVerified = async (email, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE users 
         SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW()
         WHERE email = $1 AND is_verified = FALSE
         RETURNING id, email, full_name, role, is_verified, verified_at`,
        [email]
    );
    return rows[0];
};

const countChallengesCreatedToday = async (email, challengeType) => {
    const { rows } = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM auth_challenges
         WHERE email = $1
           AND challenge_type = $2
           AND created_at >= DATE_TRUNC('day', NOW())`,
        [email, challengeType]
    );
    return rows[0]?.total ?? 0;
};

const getLatestChallenge = async (email, challengeType) => {
    const { rows } = await db.query(
        `SELECT *
         FROM auth_challenges
         WHERE email = $1 AND challenge_type = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, challengeType]
    );
    return rows[0];
};

const getActiveChallenge = async (email, challengeType) => {
    const { rows } = await db.query(
        `SELECT *
         FROM auth_challenges
         WHERE email = $1
           AND challenge_type = $2
           AND status = 'PENDING'
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, challengeType]
    );
    return rows[0];
};

const getVerificationChallengeByTokenHash = async (tokenHash) => {
    const { rows } = await db.query(
        `SELECT *
         FROM auth_challenges
         WHERE challenge_type = 'EMAIL_VERIFICATION'
           AND token_hash = $1
           AND status = 'PENDING'
           AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );
    return rows[0];
};

const createChallenge = async (challengeData, executor = db) => {
    const {
        email,
        userId,
        challengeType,
        tokenHash = null,
        otpHash = null,
        expiresAt,
        nextResendAt = null,
    } = challengeData;

    const { rows } = await queryWith(
        executor,
        `INSERT INTO auth_challenges (
            email,
            user_id,
            challenge_type,
            token_hash,
            otp_hash,
            expires_at,
            next_resend_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [email, userId || null, challengeType, tokenHash, otpHash, expiresAt, nextResendAt]
    );
    return rows[0];
};

const consumeChallenge = async (challengeId, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE auth_challenges
         SET status = 'CONSUMED', consumed_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING'
         RETURNING *`,
        [challengeId]
    );
    return rows[0];
};

const expireChallenge = async (challengeId, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE auth_challenges
         SET status = 'EXPIRED', expired_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING'
         RETURNING *`,
        [challengeId]
    );
    return rows[0];
};

const expireStaleChallenges = async () => {
    const { rows } = await db.query(
        `UPDATE auth_challenges
         SET status = 'EXPIRED', expired_at = COALESCE(expired_at, NOW()), updated_at = NOW()
         WHERE status = 'PENDING' AND expires_at <= NOW()
         RETURNING id`,
    );
    return rows.length;
};

const incrementChallengeAttempt = async (challengeId, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE auth_challenges
         SET attempt_count = attempt_count + 1,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [challengeId]
    );
    return rows[0];
};

const updatePasswordResetOtp = async (challengeId, otpHash, nextResendAt, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE auth_challenges
         SET otp_hash = $2,
             attempt_count = 0,
             resend_count = resend_count + 1,
             next_resend_at = $3,
             updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING'
         RETURNING *`,
        [challengeId, otpHash, nextResendAt]
    );
    return rows[0];
};

const updatePasswordHashByEmail = async (email, passwordHash, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE users
         SET password_hash = $2,
             updated_at = NOW()
         WHERE email = $1
         RETURNING id, email, full_name, role`,
        [email, passwordHash]
    );
    return rows[0];
};

module.exports = {
    findByEmail,
    createUser,
    updateUnverifiedUser,
    markUserVerified,
    countChallengesCreatedToday,
    getLatestChallenge,
    getActiveChallenge,
    getVerificationChallengeByTokenHash,
    createChallenge,
    consumeChallenge,
    expireChallenge,
    expireStaleChallenges,
    incrementChallengeAttempt,
    updatePasswordResetOtp,
    updatePasswordHashByEmail,
};