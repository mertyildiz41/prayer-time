-- ============================================
-- PURPOSE-BASED WORSHIP APP - SUPABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL DEFAULT 'Guest',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);

-- ============================================
-- 2. GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    purpose TEXT NOT NULL, -- Niyyah text
    activity_type TEXT NOT NULL CHECK (activity_type IN ('sholawat', 'dua', 'tasbih', 'custom', 'khatm')),
    dhikr_phrase TEXT, -- For custom dhikr or dua text
    target_count INTEGER, -- Ignored for khatm
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_activity_type ON groups(activity_type);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);

-- ============================================
-- 3. GROUP MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);

-- ============================================
-- 4. GROUP COUNTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS group_counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    count INTEGER DEFAULT 0 NOT NULL,
    message TEXT, -- Optional message like "May Allah grant health to __"
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_counters_group_id ON group_counters(group_id);
CREATE INDEX IF NOT EXISTS idx_group_counters_user_id ON group_counters(user_id);

-- ============================================
-- 5. JUZ ASSIGNMENTS TABLE (For Khatm Qur'an)
-- ============================================
CREATE TABLE IF NOT EXISTS juz_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    juz_number INTEGER NOT NULL CHECK (juz_number >= 1 AND juz_number <= 30),
    taken_by_user UUID REFERENCES users(id) ON DELETE SET NULL,
    taken_at TIMESTAMPTZ,
    UNIQUE(group_id, juz_number)
);

CREATE INDEX IF NOT EXISTS idx_juz_assignments_group_id ON juz_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_juz_assignments_taken_by ON juz_assignments(taken_by_user);

-- ============================================
-- FUNCTION TO UPDATE UPDATED_AT TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION TO INITIALIZE JUZ ASSIGNMENTS FOR KHATM GROUPS
-- ============================================
CREATE OR REPLACE FUNCTION initialize_khatm_juz()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activity_type = 'khatm' THEN
        -- Insert 30 juz assignments for new khatm group
        INSERT INTO juz_assignments (group_id, juz_number)
        SELECT NEW.id, generate_series(1, 30)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER initialize_khatm_juz_trigger
    AFTER INSERT ON groups
    FOR EACH ROW
    EXECUTE FUNCTION initialize_khatm_juz();

-- ============================================
-- FUNCTION TO CREATE GROUP COUNTER ON MEMBER JOIN
-- ============================================
CREATE OR REPLACE FUNCTION create_group_counter_on_join()
RETURNS TRIGGER AS $$
BEGIN
    -- Create counter entry when user joins group
    INSERT INTO group_counters (group_id, user_id, count)
    VALUES (NEW.group_id, NEW.user_id, 0)
    ON CONFLICT (group_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_counter_on_join
    AFTER INSERT ON group_members
    FOR EACH ROW
    EXECUTE FUNCTION create_group_counter_on_join();

