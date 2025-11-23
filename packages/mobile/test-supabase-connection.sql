-- ============================================
-- TEST SUPABASE CONNECTION
-- Run this in Supabase SQL Editor to verify everything works
-- ============================================

-- 1. Verify tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('users', 'groups', 'group_members', 'group_counters', 'juz_assignments')
ORDER BY table_name;

-- 2. Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'groups', 'group_members', 'group_counters', 'juz_assignments')
ORDER BY tablename;

-- 3. Verify RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('users', 'groups', 'group_members', 'group_counters', 'juz_assignments')
ORDER BY tablename, policyname;

-- 4. Test insert (should work if RLS allows)
INSERT INTO users (device_id, nickname)
VALUES ('test-device-123', 'Test User')
ON CONFLICT (device_id) DO NOTHING
RETURNING *;

-- 5. Test select (should work if RLS allows)
SELECT * FROM users WHERE device_id = 'test-device-123';

-- 6. Clean up test data
DELETE FROM users WHERE device_id = 'test-device-123';

-- Expected results:
-- 1. Should show all 5 tables
-- 2. Should show rls_enabled = true for all tables
-- 3. Should show policies for all tables
-- 4. Should successfully insert a test user
-- 5. Should successfully select the test user
-- 6. Should delete the test user

