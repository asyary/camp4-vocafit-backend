const db = require('../../config/db');

const queryWith = (executor, text, params) => executor.query(text, params);

const findByEmail = async (email) => {
    const { rows } = await db.query(
        `SELECT u.id,
                u.email,
                u.password,
                u.full_name,
                u.role,
                (
                    SELECT json_build_object(
                        'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                        'end_date', m.end_date,
                        'plan_code', m.plan_code,
                        'type', m.type
                    )
                    FROM memberships m
                    WHERE m.user_id = u.id AND m.canceled_at IS NULL
                    ORDER BY m.end_date DESC
                    LIMIT 1
                ) AS membership,
                u.is_verified,
                u.penalty_amount,
                u.profile_image_url,
                u.verified_at,
                u.created_at,
                u.updated_at,
                uat.account_tier_code AS membership_price_code,
                t.name AS tier
         FROM users u
         LEFT JOIN user_account_tiers uat ON uat.user_id = u.id
         LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code
         WHERE u.email = $1`,
        [email]
    );
    return rows[0];
};

const createUser = async (userData, executor = db) => {
    const { email, passwordHash, fullName, phoneNumber, birthDate, membershipPriceCode, profileImageUrl, isVerified = false, googleId = null } = userData;
    const { rows } = await queryWith(
        executor,
        `WITH inserted AS (
            INSERT INTO users (email, password, full_name, phone_number, date_of_birth, profile_image_url, is_verified, verified_at, google_id) 
            VALUES ($1, $2, $3, $6, $7, $5, $8, CASE WHEN $8 = TRUE THEN NOW() ELSE NULL END, $9)
            RETURNING id, email, full_name, role, is_verified, verified_at
        ), tier_insert AS (
            INSERT INTO user_account_tiers (user_id, account_tier_code)
            SELECT id, $4 FROM inserted
            RETURNING user_id, account_tier_code
        )
         SELECT inserted.*,
                tier_insert.account_tier_code AS membership_price_code,
                t.name AS tier
         FROM inserted
         LEFT JOIN tier_insert ON tier_insert.user_id = inserted.id
         LEFT JOIN pricing_account_tiers t ON t.code = tier_insert.account_tier_code`,
        [email, passwordHash, fullName, membershipPriceCode, profileImageUrl, phoneNumber, birthDate, isVerified, googleId]
    );
    return rows[0];
};

const updateUnverifiedUser = async (userData, executor = db) => {
    const { email, passwordHash, fullName, phoneNumber, birthDate, membershipPriceCode, profileImageUrl, isVerified = false, googleId = null } = userData;
    const { rows } = await queryWith(
        executor,
        `WITH updated AS (
            UPDATE users 
            SET password = $2,
                full_name = $3,
                phone_number = COALESCE($6, phone_number),
                date_of_birth = COALESCE($7, date_of_birth),
                profile_image_url = $5,
                is_verified = $8,
                verified_at = CASE WHEN $8 = TRUE THEN NOW() ELSE verified_at END,
                google_id = COALESCE($9, google_id),
                updated_at = NOW()
            WHERE email = $1 AND is_verified = FALSE
            RETURNING id, email, full_name, role, is_verified, verified_at
        ), tier_upsert AS (
            INSERT INTO user_account_tiers (user_id, account_tier_code)
            SELECT id, $4 FROM updated
            ON CONFLICT (user_id) DO UPDATE
            SET account_tier_code = EXCLUDED.account_tier_code,
                assigned_at = NOW()
            RETURNING user_id, account_tier_code
        )
         SELECT updated.*,
                tier_upsert.account_tier_code AS membership_price_code,
                t.name AS tier
         FROM updated
         LEFT JOIN tier_upsert ON tier_upsert.user_id = updated.id
         LEFT JOIN pricing_account_tiers t ON t.code = tier_upsert.account_tier_code`,
        [email, passwordHash, fullName, membershipPriceCode, profileImageUrl, phoneNumber, birthDate, isVerified, googleId]
    );
    return rows[0];
};

const linkGoogleAccount = async (email, googleId, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE users
         SET google_id = $2,
             is_verified = TRUE,
             verified_at = COALESCE(verified_at, NOW()),
             updated_at = NOW()
         WHERE email = $1
         RETURNING id, email, full_name, role, is_verified, verified_at`,
        [email, googleId]
    );
    return rows[0];
};

const markUserVerified = async (email, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `WITH updated AS (
            UPDATE users 
            SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW()
            WHERE email = $1 AND is_verified = FALSE
            RETURNING id, email, full_name, role, is_verified, verified_at
        )
         SELECT updated.id,
                updated.email,
                updated.full_name,
                updated.role,
                (
                    SELECT json_build_object(
                        'status', CASE WHEN m.end_date > NOW() THEN 'ACTIVE' ELSE 'EXPIRED' END,
                        'end_date', m.end_date,
                        'plan_code', m.plan_code,
                        'type', m.type
                    )
                    FROM memberships m
                    WHERE m.user_id = updated.id AND m.canceled_at IS NULL
                    ORDER BY m.end_date DESC
                    LIMIT 1
                ) AS membership,
                updated.is_verified,
                updated.verified_at,
                uat.account_tier_code AS membership_price_code,
                t.name AS tier
         FROM updated
         LEFT JOIN user_account_tiers uat ON uat.user_id = updated.id
         LEFT JOIN pricing_account_tiers t ON t.code = uat.account_tier_code`,
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
         SET password = $2,
             updated_at = NOW()
         WHERE email = $1
         RETURNING id, email, full_name, role`,
        [email, passwordHash]
    );
    return rows[0];
};

const updateVerificationChallenge = async (challengeId, tokenHash, nextResendAt, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE auth_challenges
         SET token_hash = $2,
             resend_count = resend_count + 1,
             next_resend_at = $3,
             updated_at = NOW()
         WHERE id = $1 AND status = 'PENDING'
         RETURNING *`,
        [challengeId, tokenHash, nextResendAt]
    );
    return rows[0];
};

const createAuthLog = async (logData, executor = db) => {
    const { userId, email, ipAddress, userAgent, isSuccess, reason } = logData;
    const { rows } = await queryWith(
        executor,
        `INSERT INTO auth_logs (user_id, email, ip_address, user_agent, is_success, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId || null, email, ipAddress, userAgent, isSuccess, reason]
    );
    return rows[0];
};

const getRecentFailedLogins = async (email, ipAddress) => {
    const { rows } = await db.query(
        `SELECT created_at
         FROM auth_logs
         WHERE email = $1 AND ip_address = $2 AND is_success = FALSE
           AND created_at >= NOW() - INTERVAL '10 minutes'
         ORDER BY created_at DESC`,
        [email, ipAddress]
    );
    return rows;
};

const createUserSession = async (sessionData, executor = db) => {
    const { id, userId, refreshTokenHash, ipAddress, city, country, deviceType, userAgent } = sessionData;
    const { rows } = await queryWith(
        executor,
        `INSERT INTO user_sessions (id, user_id, refresh_token_hash, ip_address, city, country, device_type, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, userId, refreshTokenHash, ipAddress, city, country, deviceType, userAgent]
    );
    return rows[0];
};

const invalidateSession = async (sessionId, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE user_sessions
         SET is_active = FALSE
         WHERE id = $1
         RETURNING *`,
        [sessionId]
    );
    return rows[0];
};

const invalidateAllUserSessions = async (userId, executor = db) => {
    const { rows } = await queryWith(
        executor,
        `UPDATE user_sessions
         SET is_active = FALSE
         WHERE user_id = $1 AND is_active = TRUE
         RETURNING *`,
        [userId]
    );
    return rows;
};

module.exports = {
    findByEmail,
    createUser,
    updateUnverifiedUser,
    markUserVerified,
    linkGoogleAccount,
    countChallengesCreatedToday,
    getActiveChallenge,
    getVerificationChallengeByTokenHash,
    createChallenge,
    consumeChallenge,
    expireChallenge,
    expireStaleChallenges,
    incrementChallengeAttempt,
    updatePasswordResetOtp,
    updatePasswordHashByEmail,
    updateVerificationChallenge,
    createAuthLog,
    getRecentFailedLogins,
    createUserSession,
    invalidateSession,
    invalidateAllUserSessions,
};