const db = require('../../config/db');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeEmailList = (emails = []) => Array.from(
    new Set(
        emails
            .map(normalizeEmail)
            .filter(Boolean)
    )
);

const createServiceError = (message, status, data = null) => {
    const error = new Error(message);
    error.status = status;
    error.data = data;
    return error;
};

const runInTransaction = async (callback) => {
    return await db.withTransaction(callback);
};

const createTrainer = async (data, executor = db) => {
    const { name, email, phoneNumber, bio, specialties, imageUrl } = data;
    const { rows } = await executor.query(
        `INSERT INTO trainers (name, email, phone_number, bio, specialties, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, email, phoneNumber || null, bio || null, specialties || null, imageUrl || null]
    );
    return rows[0];
};

const getAllTrainers = async ({ limit, offset }, executor = db) => {
    const baseCondition = `FROM trainers WHERE is_active = TRUE`;

    const [{ rows }, { rows: countRows }] = await Promise.all([
        executor.query(
            `SELECT id, name, email, phone_number, bio, specialties, image_url,
                    (SELECT COUNT(*)::int FROM trainer_packages tp WHERE tp.trainer_id = trainers.id AND tp.status = 'ACTIVE' AND tp.expires_at > NOW()) AS active_booking,
                    (SELECT COUNT(*)::int FROM trainer_packages tp WHERE tp.trainer_id = trainers.id AND tp.status != 'CANCELED') AS total_booking,
                    is_active, created_at, updated_at
             ${baseCondition} ORDER BY created_at ASC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        ),
        executor.query(`SELECT COUNT(*)::int AS total ${baseCondition}`)
    ]);

    return { rows, totalCount: countRows[0].total };
};

const getTrainerById = async (trainerId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT id, name, email, phone_number, bio, specialties, image_url,
                (SELECT COUNT(*)::int FROM trainer_packages tp WHERE tp.trainer_id = trainers.id AND tp.status = 'ACTIVE' AND tp.expires_at > NOW()) AS active_booking,
                (SELECT COUNT(*)::int FROM trainer_packages tp WHERE tp.trainer_id = trainers.id AND tp.status != 'CANCELED') AS total_booking,
                is_active, created_at, updated_at
         FROM trainers WHERE id = $1 AND is_active = TRUE`,
        [trainerId]
    );
    return rows[0];
};

const findTrainerById = async (trainerId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT id, name, email, phone_number, bio, specialties, image_url,
                (SELECT COUNT(*)::int FROM trainer_packages tp WHERE tp.trainer_id = trainers.id AND tp.status = 'ACTIVE' AND tp.expires_at > NOW()) AS active_booking,
                (SELECT COUNT(*)::int FROM trainer_packages tp WHERE tp.trainer_id = trainers.id AND tp.status != 'CANCELED') AS total_booking,
                is_active, created_at, updated_at
         FROM trainers WHERE id = $1`,
        [trainerId]
    );
    return rows[0];
};

const updateTrainer = async (trainerId, data, executor = db) => {
    const fieldMap = {
        name: 'name',
        email: 'email',
        phoneNumber: 'phone_number',
        bio: 'bio',
        specialties: 'specialties',
        imageUrl: 'image_url',
    };

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, column] of Object.entries(fieldMap)) {
        if (data[key] !== undefined) {
            setClauses.push(`${column} = $${paramIndex}`);
            values.push(data[key]);
            paramIndex++;
        }
    }

    if (setClauses.length === 0) {
        return await findTrainerById(trainerId, executor);
    }

    setClauses.push('updated_at = NOW()');
    values.push(trainerId);

    const { rows } = await executor.query(
        `UPDATE trainers SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
    );
    return rows[0];
};

const deactivateTrainer = async (trainerId, executor = db) => {
    const { rows } = await executor.query(
        'UPDATE trainers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [trainerId]
    );
    return rows[0];
};

const hasActiveMembership = async (userId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT 1
         FROM memberships
         WHERE user_id = $1
           AND end_date > NOW()
           AND canceled_at IS NULL
         LIMIT 1`,
        [userId]
    );
    return rows.length > 0;
};

const getUsersByEmails = async (emails, executor = db) => {
    const normalizedEmails = normalizeEmailList(emails);
    if (normalizedEmails.length === 0) return [];

    const { rows } = await executor.query(
        `SELECT u.id,
                LOWER(u.email) AS email,
                u.full_name,
                u.is_verified,
                EXISTS (
                    SELECT 1
                    FROM memberships m
                    WHERE m.user_id = u.id
                      AND m.end_date > NOW()
                      AND m.canceled_at IS NULL
                ) AS has_active_membership
         FROM users u
         WHERE LOWER(u.email) = ANY($1::text[])`,
        [normalizedEmails]
    );

    return rows;
};

const getActiveTrainerPackageConflicts = async (userIds, executor = db) => {
    if (!userIds || userIds.length === 0) return [];

    const { rows } = await executor.query(
        `SELECT DISTINCT u.id AS user_id,
                u.email,
                tp.id AS package_id
         FROM trainer_package_members tpm
         JOIN trainer_packages tp ON tp.id = tpm.package_id
         JOIN users u ON u.id = tpm.user_id
         WHERE tpm.user_id = ANY($1::uuid[])
           AND tp.status = 'ACTIVE'
           AND tp.expires_at > NOW()`,
        [userIds]
    );

    return rows;
};

const getPackageById = async (packageId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT tp.*,
                c.name AS catalog_name,
                c.session_count,
                c.group_size,
                t.name AS trainer_name,
                t.email AS trainer_email
         FROM trainer_packages tp
         JOIN pricing_catalog c ON c.code = tp.catalog_code
         JOIN trainers t ON t.id = tp.trainer_id
         WHERE tp.id = $1`,
        [packageId]
    );
    return rows[0];
};

const getPackageByIdForUser = async (packageId, userId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT tp.*,
                c.name AS catalog_name,
                c.session_count,
                c.group_size,
                t.name AS trainer_name,
                t.email AS trainer_email
         FROM trainer_packages tp
         JOIN pricing_catalog c ON c.code = tp.catalog_code
         JOIN trainers t ON t.id = tp.trainer_id
         JOIN trainer_package_members tpm ON tpm.package_id = tp.id
         WHERE tp.id = $1
           AND tpm.user_id = $2`,
        [packageId, userId]
    );
    return rows[0];
};

const listPackagesByUserId = async (userId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT DISTINCT tp.*,
                c.name AS catalog_name,
                c.session_count,
                c.group_size,
                t.name AS trainer_name,
                t.email AS trainer_email
         FROM trainer_packages tp
         JOIN pricing_catalog c ON c.code = tp.catalog_code
         JOIN trainers t ON t.id = tp.trainer_id
         JOIN trainer_package_members tpm ON tpm.package_id = tp.id
         WHERE tpm.user_id = $1
         ORDER BY tp.purchased_at DESC`,
        [userId]
    );
    return rows;
};

const listSessionsByPackageId = async (packageId, forMember = false, executor = db) => {
    let whereClause = `WHERE ts.package_id = $1`;
    if (forMember) {
        whereClause += ` AND ts.status != 'CANCELLED' AND timezone('Asia/Jakarta', ts.start_time)::date >= timezone('Asia/Jakarta', NOW())::date`;
    }
    const { rows } = await executor.query(
        `SELECT ts.*,
                u.full_name AS booked_by_name
         FROM trainer_sessions ts
         LEFT JOIN users u ON u.id = ts.booked_by_user_id
         ${whereClause}
         ORDER BY ts.start_time ASC`,
        [packageId]
    );
    return rows;
};

const getSessionById = async (sessionId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT ts.*,
                tp.buyer_user_id,
                tp.trainer_id AS package_trainer_id,
                tp.status AS package_status,
                tp.expires_at,
                c.group_size,
                c.session_count,
                t.name AS trainer_name,
                t.email AS trainer_email
         FROM trainer_sessions ts
         JOIN trainer_packages tp ON tp.id = ts.package_id
         JOIN pricing_catalog c ON c.code = tp.catalog_code
         JOIN trainers t ON t.id = tp.trainer_id
         WHERE ts.id = $1`,
        [sessionId]
    );
    return rows[0];
};

const getPackageForUpdate = async (client, packageId) => {
    const { rows } = await client.query(
        `SELECT tp.*,
                c.session_count,
                c.group_size
         FROM trainer_packages tp
         JOIN pricing_catalog c ON c.code = tp.catalog_code
         WHERE tp.id = $1
         FOR UPDATE`,
        [packageId]
    );
    return rows[0];
};

const getSessionWithPackageForUpdate = async (client, sessionId) => {
    const { rows } = await client.query(
        `SELECT ts.*,
                tp.status AS package_status,
                tp.expires_at,
                tp.session_remaining,
                tp.session_total,
                tp.trainer_id AS package_trainer_id
         FROM trainer_sessions ts
         JOIN trainer_packages tp ON tp.id = ts.package_id
         WHERE ts.id = $1
         FOR UPDATE`,
        [sessionId]
    );
    return rows[0];
};

const isConfirmedPackageMember = async (packageId, userId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT 1
         FROM trainer_package_members
         WHERE package_id = $1
           AND user_id = $2
           AND status = 'CONFIRMED'
         LIMIT 1`,
        [packageId, userId]
    );
    return rows.length > 0;
};

const canMemberCancelSession = async (sessionId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT timezone('Asia/Jakarta', NOW())::date <= (timezone('Asia/Jakarta', start_time)::date - 2) AS can_cancel
         FROM trainer_sessions
         WHERE id = $1`,
        [sessionId]
    );
    return rows[0]?.can_cancel ?? false;
};

const checkOverlappingSession = async (client, trainerId, startTime, endTime) => {
    const { rows } = await client.query(
        `SELECT 1
         FROM trainer_sessions
         WHERE trainer_id = $1
           AND status != 'CANCELLED'
           AND start_time < $3
           AND end_time > $2
         LIMIT 1`,
        [trainerId, startTime, endTime]
    );
    return rows.length > 0;
};

const insertSession = async (client, { packageId, trainerId, bookedByUserId, startTime, endTime }) => {
    const { rows } = await client.query(
        `INSERT INTO trainer_sessions (
            package_id, trainer_id, booked_by_user_id, start_time, end_time
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [packageId, trainerId, bookedByUserId, startTime, endTime]
    );
    return rows[0];
};

const markSessionCancelled = async (client, sessionId, { canceledByUserId, canceledByRole, cancelReason }) => {
    const { rows } = await client.query(
        `UPDATE trainer_sessions
         SET status = 'CANCELLED',
             canceled_by_user_id = $2,
             canceled_by_role = $3,
             canceled_at = NOW(),
             cancel_reason = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [sessionId, canceledByUserId, canceledByRole, cancelReason || null]
    );
    return rows[0];
};

const updatePackageAfterSessionChange = async (client, packageId, delta) => {
    const { rows } = await client.query(
        `UPDATE trainer_packages
         SET session_remaining = session_remaining + $2,
             status = CASE
                 WHEN session_remaining + $2 <= 0 THEN 'EXHAUSTED'
                 ELSE 'ACTIVE'
             END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [packageId, delta]
    );
    return rows[0];
};

const restorePackageSession = async (client, packageId) => {
    const { rows } = await client.query(
        `UPDATE trainer_packages
         SET session_remaining = session_remaining + 1,
             status = 'ACTIVE',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [packageId]
    );
    return rows[0];
};

const createTrainerPackageFromTransaction = async (client, transaction) => {
    const { rows: catalogRows } = await client.query(
        `SELECT code, group_size, session_count, duration_days
         FROM pricing_catalog
         WHERE code = $1
           AND family = 'PERSONAL_TRAINER'
           AND is_active = TRUE`,
        [transaction.transaction_type]
    );

    const catalog = catalogRows[0];
    if (!catalog) {
        throw createServiceError('Trainer package catalog not found', 404);
    }

    const trainer = await getTrainerById(transaction.trainer_id, client);
    if (!trainer) {
        throw createServiceError('Trainer not found or inactive', 404);
    }

    const { rows: buyerRows } = await client.query(
        'SELECT id, email FROM users WHERE id = $1 AND is_verified = TRUE',
        [transaction.user_id]
    );
    const buyer = buyerRows[0];
    if (!buyer) {
        throw createServiceError('Buyer not found or inactive', 404);
    }

    const participantEmails = Array.isArray(transaction.trainer_participant_emails)
        ? transaction.trainer_participant_emails
        : [];
    const normalizedEmails = normalizeEmailList([buyer.email, ...participantEmails]);

    if (normalizedEmails.length !== Number(catalog.group_size)) {
        throw createServiceError('Participant count does not match the package size', 400);
    }

    const members = await getUsersByEmails(normalizedEmails, client);
    if (members.length !== normalizedEmails.length) {
        const foundEmails = new Set(members.map((member) => member.email));
        const missingEmails = normalizedEmails.filter((email) => !foundEmails.has(email));
        throw createServiceError('Some participant emails are invalid or unregistered', 400, { missingEmails });
    }

    const invalidMembers = members.filter((member) => !member.is_verified || !member.has_active_membership);
    if (invalidMembers.length > 0) {
        throw createServiceError('All participants must have an active membership', 403, {
            invalidEmails: invalidMembers.map((member) => member.email)
        });
    }

    const conflicts = await getActiveTrainerPackageConflicts(members.map((member) => member.id), client);
    if (conflicts.length > 0) {
        throw createServiceError('One or more participants already have an active trainer package', 409, {
            conflicts: conflicts.map((conflict) => conflict.email)
        });
    }

    const { rows: membershipRows } = await client.query(
        `SELECT id
         FROM memberships
         WHERE user_id = $1
           AND end_date > NOW()
           AND canceled_at IS NULL
         ORDER BY end_date DESC
         LIMIT 1`,
        [buyer.id]
    );
    const membership = membershipRows[0] || null;

    const durationDays = Number(catalog.duration_days) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    expiresAt.setHours(23, 59, 59, 999);

    const { rows: packageRows } = await client.query(
        `INSERT INTO trainer_packages (
            transaction_id,
            buyer_user_id,
            trainer_id,
            membership_id,
            catalog_code,
            group_size,
            session_total,
            session_remaining,
            status,
            purchased_at,
            expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), $9)
        RETURNING *`,
        [
            transaction.id,
            buyer.id,
            trainer.id,
            membership?.id || null,
            catalog.code,
            Number(catalog.group_size),
            Number(catalog.session_count),
            Number(catalog.session_count),
            expiresAt
        ]
    );

    const createdPackage = packageRows[0];

    for (const member of members) {
        await client.query(
            `INSERT INTO trainer_package_members (package_id, user_id, email, is_primary, status)
             VALUES ($1, $2, $3, $4, 'CONFIRMED')`,
            [createdPackage.id, member.id, member.email, member.id === buyer.id]
        );
    }

    return createdPackage;
};

const cancelTrainerPackageByTransactionId = async (client, transactionId) => {
    const { rows: packageRows } = await client.query(
        `SELECT id, status
         FROM trainer_packages
         WHERE transaction_id = $1
         LIMIT 1`,
        [transactionId]
    );

    const packageRow = packageRows[0];
    if (!packageRow) return null;

    if (packageRow.status === 'CANCELED' || packageRow.status === 'EXPIRED') {
        return packageRow;
    }

    await client.query(
        `UPDATE trainer_sessions
         SET status = 'CANCELLED',
             canceled_at = COALESCE(canceled_at, NOW()),
             updated_at = NOW()
         WHERE package_id = $1
           AND status = 'BOOKED'
           AND start_time > NOW()`,
        [packageRow.id]
    );

    const { rows } = await client.query(
        `UPDATE trainer_packages
         SET status = 'CANCELED',
             session_remaining = 0,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [packageRow.id]
    );

    return rows[0];
};

const expireTrainerPackages = async () => {
    const { rowCount } = await db.query(
        `UPDATE trainer_packages
         SET status = 'EXPIRED',
             updated_at = NOW()
         WHERE status = 'ACTIVE'
           AND expires_at <= NOW()`
    );

    return rowCount;
};

const getAllSessions = async ({ limit, offset, startDate, endDate }, executor = db) => {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (startDate) {
        conditions.push(`ts.start_time >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        conditions.push(`ts.start_time <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
        SELECT ts.*,
               t.name         AS trainer_name,
               t.email        AS trainer_email,
               t.phone_number AS trainer_phone_number,
               tp.catalog_code,
               u.full_name AS booked_by_name
        FROM trainer_sessions ts
        JOIN trainer_packages tp ON tp.id = ts.package_id
        JOIN trainers t          ON t.id  = ts.trainer_id
        LEFT JOIN users u        ON u.id  = ts.booked_by_user_id
        ${whereClause}
        ORDER BY ts.start_time ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM trainer_sessions ts
        JOIN trainer_packages tp ON tp.id = ts.package_id
        JOIN trainers t          ON t.id  = ts.trainer_id
        ${whereClause}`;

    const [{ rows }, { rows: countRows }] = await Promise.all([
        executor.query(dataQuery, [...values, limit, offset]),
        executor.query(countQuery, values),
    ]);

    return { rows, totalCount: countRows[0].total };
};

const getSessionsByTrainerId = async (trainerId, { limit, offset, startDate, endDate, forMember }, executor = db) => {
    const conditions = [`ts.trainer_id = $1`];
    const values = [trainerId];
    let paramIndex = 2;

    if (forMember) {
        conditions.push(`ts.status != 'CANCELLED'`);
        conditions.push(`timezone('Asia/Jakarta', ts.start_time)::date >= timezone('Asia/Jakarta', NOW())::date`);
    }

    if (startDate) {
        conditions.push(`ts.start_time >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        conditions.push(`ts.start_time <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const dataQuery = `
        SELECT ts.*,
               t.name         AS trainer_name,
               t.email        AS trainer_email,
               t.phone_number AS trainer_phone_number,
               tp.catalog_code,
               u.full_name AS booked_by_name
        FROM trainer_sessions ts
        JOIN trainer_packages tp ON tp.id = ts.package_id
        JOIN trainers t          ON t.id  = ts.trainer_id
        LEFT JOIN users u        ON u.id  = ts.booked_by_user_id
        ${whereClause}
        ORDER BY ts.start_time ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM trainer_sessions ts
        ${whereClause}`;

    const [{ rows }, { rows: countRows }] = await Promise.all([
        executor.query(dataQuery, [...values, limit, offset]),
        executor.query(countQuery, values),
    ]);

    return { rows, totalCount: countRows[0].total };
};

const isMemberOfTrainerPackage = async (trainerId, userId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT 1
         FROM trainer_package_members tpm
         JOIN trainer_packages tp ON tp.id = tpm.package_id
         WHERE tp.trainer_id = $1
           AND tpm.user_id = $2
           AND tpm.status = 'CONFIRMED'
         LIMIT 1`,
        [trainerId, userId]
    );
    return rows.length > 0;
};

const getMySessionsAsBooker = async (userId, { limit, offset, startDate, endDate }, executor = db) => {
    const conditions = [`ts.booked_by_user_id = $1`];
    const values = [userId];
    let paramIndex = 2;

    conditions.push(`ts.status != 'CANCELLED'`);
    conditions.push(`timezone('Asia/Jakarta', ts.start_time)::date >= timezone('Asia/Jakarta', NOW())::date`);

    if (startDate) {
        conditions.push(`ts.start_time >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        conditions.push(`ts.start_time <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const dataQuery = `
        SELECT ts.*,
               t.name         AS trainer_name,
               t.email        AS trainer_email,
               t.phone_number AS trainer_phone_number,
               tp.catalog_code
        FROM trainer_sessions ts
        JOIN trainer_packages tp ON tp.id = ts.package_id
        JOIN trainers t          ON t.id  = ts.trainer_id
        ${whereClause}
        ORDER BY ts.start_time ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM trainer_sessions ts
        ${whereClause}`;

    const [{ rows }, { rows: countRows }] = await Promise.all([
        executor.query(dataQuery, [...values, limit, offset]),
        executor.query(countQuery, values),
    ]);

    return { rows, totalCount: countRows[0].total };
};

const getSessionNotificationData = async (sessionId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT ts.id AS session_id,
                ts.start_time,
                ts.end_time,
                ts.booked_by_user_id,
                t.id AS trainer_id,
                t.name AS trainer_name,
                t.email AS trainer_email,
                u.full_name AS booked_by_name,
                u.email AS booked_by_email,
                c.name AS package_name
         FROM trainer_sessions ts
         JOIN trainer_packages tp ON tp.id = ts.package_id
         JOIN trainers t ON t.id = ts.trainer_id
         JOIN pricing_catalog c ON c.code = tp.catalog_code
         LEFT JOIN users u ON u.id = ts.booked_by_user_id
         WHERE ts.id = $1`,
        [sessionId]
    );
    return rows[0] || null;
};

const getUserBasicInfo = async (userId, executor = db) => {
    const { rows } = await executor.query(
        `SELECT id, full_name, email FROM users WHERE id = $1`,
        [userId]
    );
    return rows[0] || null;
};

module.exports = {
    normalizeEmailList,
    runInTransaction,
    createTrainer,
    getAllTrainers,
    getTrainerById,
    findTrainerById,
    updateTrainer,
    deactivateTrainer,
    hasActiveMembership,
    getUsersByEmails,
    getActiveTrainerPackageConflicts,
    getPackageById,
    getPackageByIdForUser,
    listPackagesByUserId,
    listSessionsByPackageId,
    getSessionById,
    getPackageForUpdate,
    getSessionWithPackageForUpdate,
    isConfirmedPackageMember,
    canMemberCancelSession,
    checkOverlappingSession,
    insertSession,
    markSessionCancelled,
    updatePackageAfterSessionChange,
    restorePackageSession,
    createTrainerPackageFromTransaction,
    cancelTrainerPackageByTransactionId,
    expireTrainerPackages,
    getAllSessions,
    getSessionsByTrainerId,
    isMemberOfTrainerPackage,
    getMySessionsAsBooker,
    getSessionNotificationData,
    getUserBasicInfo,
};