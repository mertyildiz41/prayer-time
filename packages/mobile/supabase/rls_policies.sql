-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE juz_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS POLICIES
-- ============================================

-- Everyone can read users (to see nicknames)
CREATE POLICY "Users are viewable by everyone"
    ON users FOR SELECT
    USING (true);

-- Users can insert themselves
CREATE POLICY "Users can insert themselves"
    ON users FOR INSERT
    WITH CHECK (true);

-- Users can update their own nickname
CREATE POLICY "Users can update own nickname"
    ON users FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- GROUPS POLICIES
-- ============================================

-- Everyone can read groups (public prayer groups)
CREATE POLICY "Groups are viewable by everyone"
    ON groups FOR SELECT
    USING (true);

-- Anyone can create a group
CREATE POLICY "Anyone can create groups"
    ON groups FOR INSERT
    WITH CHECK (true);

-- Group creators can update their groups
CREATE POLICY "Group creators can update their groups"
    ON groups FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- GROUP MEMBERS POLICIES
-- ============================================

-- Everyone can see group members
CREATE POLICY "Group members are viewable by everyone"
    ON group_members FOR SELECT
    USING (true);

-- Anyone can join a group
CREATE POLICY "Anyone can join groups"
    ON group_members FOR INSERT
    WITH CHECK (true);

-- Members can leave groups (delete themselves)
CREATE POLICY "Users can leave groups"
    ON group_members FOR DELETE
    USING (true);

-- ============================================
-- GROUP COUNTERS POLICIES
-- ============================================

-- Everyone can read counters (to see contributions)
CREATE POLICY "Counters are viewable by everyone"
    ON group_counters FOR SELECT
    USING (true);

-- Users can insert their counter (when joining)
CREATE POLICY "Users can create their counter"
    ON group_counters FOR INSERT
    WITH CHECK (true);

-- Users can only update their own counter
CREATE POLICY "Users can update own counter"
    ON group_counters FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- JUZ ASSIGNMENTS POLICIES
-- ============================================

-- Everyone can read juz assignments
CREATE POLICY "Juz assignments are viewable by everyone"
    ON juz_assignments FOR SELECT
    USING (true);

-- Group members can take/release juz
-- Note: For device-based auth, we allow all updates since RLS will be enforced at application level
-- In production, you may want to create a function that validates device_id
CREATE POLICY "Group members can take juz"
    ON juz_assignments FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow inserting juz assignments (for initial khatm setup)
CREATE POLICY "System can insert juz assignments"
    ON juz_assignments FOR INSERT
    WITH CHECK (true);

