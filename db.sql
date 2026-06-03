CREATE TABLE pricing_account_tiers (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pricing_catalog (
    code VARCHAR(100) PRIMARY KEY,
    family VARCHAR(30) NOT NULL CHECK (family IN ('MEMBERSHIP', 'PERSONAL_TRAINER')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_size INTEGER,
    session_count INTEGER,
    duration_days INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pricing_catalog_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_code VARCHAR(100) NOT NULL REFERENCES pricing_catalog(code) ON DELETE CASCADE,
    account_tier_code VARCHAR(50) NOT NULL REFERENCES pricing_account_tiers(code) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (catalog_code, account_tier_code)
);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'pengurus')),
    is_verified BOOLEAN DEFAULT FALSE,
    penalty_amount NUMERIC(10, 2) DEFAULT 0, -- Stacks 5k for missed tap-outs
	profile_image_url VARCHAR(255) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_account_tiers (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    account_tier_code VARCHAR(50) NOT NULL REFERENCES pricing_account_tiers(code),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auth Challenges (Email verification & password reset OTP)
CREATE TABLE auth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
    token_hash VARCHAR(255),
    otp_hash VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONSUMED', 'EXPIRED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    resend_count INTEGER NOT NULL DEFAULT 0,
    next_resend_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_challenges_email_type_status ON auth_challenges (email, challenge_type, status);
CREATE INDEX idx_auth_challenges_expires_at ON auth_challenges (expires_at);

-- Active Memberships
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    transaction_id UUID UNIQUE,
    plan_code VARCHAR(100) REFERENCES pricing_catalog(code),
    type VARCHAR(20) CHECK (type IN ('daily', 'monthly')),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (Midtrans & Cash)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('QRIS', 'CASH')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    penalty_amount NUMERIC(10, 2) DEFAULT 0,
	catalog_code VARCHAR(100) NOT NULL REFERENCES pricing_catalog(code),
    account_tier_code VARCHAR(50) REFERENCES pricing_account_tiers(code),
    trainer_id UUID,
	trainer_participant_emails JSONB,
	trainer_group_size INTEGER,
	order_id VARCHAR(255),
	payment_url VARCHAR(255),
	snap_token VARCHAR(255),
    expire_at TIMESTAMP WITH TIME ZONE, -- 24h for cash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
	settled_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE memberships
    ADD CONSTRAINT fk_memberships_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;

INSERT INTO pricing_account_tiers (code, name, description, sort_order) VALUES
    ('UMUM', 'Umum', 'Pengguna non-Unesa', 1),
    ('PEGAWAI_KARYAWAN', 'Pegawai / Karyawan', 'Pengguna Unesa dengan status pegawai atau karyawan', 2),
    ('MAHASISWA_NON_VOKASI', 'Mahasiswa Non-Vokasi', 'Pengguna Unesa dengan status mahasiswa di luar Fakultas Vokasi', 3),
    ('MAHASISWA_VOKASI', 'Mahasiswa Vokasi', 'Pengguna Unesa dengan status mahasiswa Fakultas Vokasi', 4);

INSERT INTO pricing_catalog (code, family, name, description, group_size, session_count, duration_days, sort_order) VALUES
    ('MEMBERSHIP_DAILY', 'MEMBERSHIP', 'Membership Daily', 'Akses membership harian', NULL, NULL, 1, 1),
    ('MEMBERSHIP_MONTHLY', 'MEMBERSHIP', 'Membership Monthly', 'Akses membership bulanan', NULL, NULL, 30, 2),
    ('PT_SESSION', 'PERSONAL_TRAINER', 'Personal Trainer Single', 'Personal trainer untuk 1 orang selama 10 sesi', 1, 10, NULL, 3),
    ('GROUP_FITNESS_3', 'PERSONAL_TRAINER', 'Group Fitness 3 Pax', 'Personal trainer untuk 3 orang selama 10 sesi', 3, 10, NULL, 4),
    ('GROUP_FITNESS_4', 'PERSONAL_TRAINER', 'Group Fitness 4 Pax', 'Personal trainer untuk 4 orang selama 10 sesi', 4, 10, NULL, 5),
    ('GROUP_FITNESS_5', 'PERSONAL_TRAINER', 'Group Fitness 5 Pax', 'Personal trainer untuk 5 orang selama 10 sesi', 5, 10, NULL, 6);

INSERT INTO pricing_catalog_prices (catalog_code, account_tier_code, price) VALUES
    ('MEMBERSHIP_DAILY', 'UMUM', 15000),
    ('MEMBERSHIP_DAILY', 'PEGAWAI_KARYAWAN', 15000),
    ('MEMBERSHIP_DAILY', 'MAHASISWA_NON_VOKASI', 15000),
    ('MEMBERSHIP_DAILY', 'MAHASISWA_VOKASI', 15000),
    ('MEMBERSHIP_MONTHLY', 'UMUM', 300000),
    ('MEMBERSHIP_MONTHLY', 'PEGAWAI_KARYAWAN', 200000),
    ('MEMBERSHIP_MONTHLY', 'MAHASISWA_NON_VOKASI', 150000),
    ('MEMBERSHIP_MONTHLY', 'MAHASISWA_VOKASI', 100000),
    ('PT_SESSION', 'UMUM', 500000),
    ('PT_SESSION', 'PEGAWAI_KARYAWAN', 500000),
    ('PT_SESSION', 'MAHASISWA_NON_VOKASI', 500000),
    ('PT_SESSION', 'MAHASISWA_VOKASI', 500000),
    ('GROUP_FITNESS_3', 'UMUM', 375000),
    ('GROUP_FITNESS_3', 'PEGAWAI_KARYAWAN', 375000),
    ('GROUP_FITNESS_3', 'MAHASISWA_NON_VOKASI', 375000),
    ('GROUP_FITNESS_3', 'MAHASISWA_VOKASI', 375000),
    ('GROUP_FITNESS_4', 'UMUM', 350000),
    ('GROUP_FITNESS_4', 'PEGAWAI_KARYAWAN', 350000),
    ('GROUP_FITNESS_4', 'MAHASISWA_NON_VOKASI', 350000),
    ('GROUP_FITNESS_4', 'MAHASISWA_VOKASI', 350000),
    ('GROUP_FITNESS_5', 'UMUM', 325000),
    ('GROUP_FITNESS_5', 'PEGAWAI_KARYAWAN', 325000),
    ('GROUP_FITNESS_5', 'MAHASISWA_NON_VOKASI', 325000),
    ('GROUP_FITNESS_5', 'MAHASISWA_VOKASI', 325000);

-- Gym Visits (Tap In/Out & Crowd Meter)
CREATE TABLE gym_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    tap_in_time TIMESTAMP WITH TIME ZONE,
    tap_out_time TIMESTAMP WITH TIME ZONE,
    qr_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- News 
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES users(id),
    image_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trainers & Schedules
CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    bio TEXT,
    specialties TEXT,
    image_url VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_trainer
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL;

CREATE TABLE trainer_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE
);

CREATE TABLE trainer_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID UNIQUE REFERENCES transactions(id) ON DELETE SET NULL,
    buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id),
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    catalog_code VARCHAR(100) NOT NULL REFERENCES pricing_catalog(code),
    group_size INTEGER NOT NULL,
    session_total INTEGER NOT NULL,
    session_remaining INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'CANCELED', 'EXPIRED')),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (session_remaining >= 0 AND session_remaining <= session_total),
    CHECK (group_size >= 1)
);

CREATE TABLE trainer_package_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES trainer_packages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('INVITED', 'CONFIRMED', 'DECLINED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (package_id, email)
);

CREATE TABLE trainer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES trainer_packages(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    booked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    canceled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    canceled_by_role VARCHAR(20) CHECK (canceled_by_role IN ('member', 'pengurus')),
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time = start_time + INTERVAL '2 hours'),
    CHECK (EXTRACT(MINUTE FROM start_time) IN (0, 30)),
    CHECK (start_time::time >= TIME '06:00' AND start_time::time <= TIME '19:00')
);

CREATE UNIQUE INDEX uniq_trainer_sessions_trainer_start
    ON trainer_sessions (trainer_id, start_time)
    WHERE status IN ('BOOKED', 'COMPLETED');

CREATE UNIQUE INDEX uniq_active_trainer_package_per_buyer
    ON trainer_packages (buyer_user_id)
    WHERE status = 'ACTIVE';

CREATE INDEX idx_trainer_packages_status_expires_at
    ON trainer_packages (status, expires_at);

CREATE INDEX idx_trainer_package_members_user_id
    ON trainer_package_members (user_id);

CREATE INDEX idx_trainer_sessions_package_id
    ON trainer_sessions (package_id);

INSERT INTO trainers (name, email, phone_number, bio, specialties, image_url, is_active) VALUES
    ('Alya Pratama', 'alya.pratama@vocafit.example', '+62-811-1111-111', 'Strength and mobility coach focused on safe progression and recovery.', 'Strength training, mobility, injury prevention', 'https://images.example.com/trainers/alya-pratama.jpg', TRUE),
    ('Rafi Nugroho', 'rafi.nugroho@vocafit.example', '+62-812-2222-222', 'High-energy conditioning coach with HIIT and athletic performance focus.', 'HIIT, conditioning, athletic performance', 'https://images.example.com/trainers/rafi-nugroho.jpg', TRUE),
    ('Sinta Kurnia', 'sinta.kurnia@vocafit.example', '+62-813-3333-333', 'Body recomposition specialist with nutrition coaching background.', 'Body recomposition, core training, nutrition basics', 'https://images.example.com/trainers/sinta-kurnia.jpg', TRUE),
    ('Dimas Hartono', 'dimas.hartono@vocafit.example', '+62-814-4444-444', 'Beginner-friendly trainer emphasizing form, consistency, and confidence.', 'Beginner programs, functional training', 'https://images.example.com/trainers/dimas-hartono.jpg', TRUE);

-- To-Do / Activity Tracker for Members
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);