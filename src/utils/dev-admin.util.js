const bcrypt = require('bcrypt');
const db = require('../config/db');

const REQUIRED_ADMIN_ENV_VARS = [
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'ADMIN_FULL_NAME',
    'ADMIN_PROFILE_IMAGE_URL'
];

const getMissingAdminEnvVars = () => {
    return REQUIRED_ADMIN_ENV_VARS.filter((key) => !process.env[key]);
};

const ensureDevAdminUser = async () => {
    // if (process.env.NODE_ENV === 'production') return;

    const missingVars = getMissingAdminEnvVars();
    if (missingVars.length > 0) {
        console.warn(`Dev admin seed skipped. Missing env vars: ${missingVars.join(', ')}`);
        return;
    }

    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

    await db.query(
        `INSERT INTO users (
            email,
            password,
            full_name,
            role,
            is_verified,
            verified_at,
            profile_image_url
        ) VALUES ($1, $2, $3, 'pengurus', TRUE, NOW(), $4)
        ON CONFLICT (email) DO UPDATE
        SET password = EXCLUDED.password,
            full_name = EXCLUDED.full_name,
            role = 'pengurus',
            is_verified = TRUE,
            verified_at = NOW(),
            profile_image_url = EXCLUDED.profile_image_url,
            updated_at = NOW()`,
        [
            process.env.ADMIN_EMAIL,
            passwordHash,
            process.env.ADMIN_FULL_NAME,
            process.env.ADMIN_PROFILE_IMAGE_URL
        ]
    );

    console.log(`Dev admin ensured: ${process.env.ADMIN_EMAIL}`);
};

const initDevAdmin = async () => {
    await ensureDevAdminUser();
};

module.exports = { initDevAdmin };
