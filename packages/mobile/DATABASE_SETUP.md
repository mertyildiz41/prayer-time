# Database Setup Instructions

## ⚠️ Error: Table "users" not found

You're seeing this error because the database tables haven't been created yet. Follow these steps:

## Step-by-Step Setup

### 1. Open Supabase Dashboard
- Go to: https://trlgorbysnlastxucfsu.supabase.co
- Click **"SQL Editor"** in the left sidebar

### 2. Run Schema Migration
1. In SQL Editor, click **"New Query"**
2. Open the file: `packages/mobile/supabase/schema.sql`
3. **Copy ALL the contents** from the file
4. **Paste** into the SQL Editor
5. Click **"Run"** button (or press Ctrl/Cmd + Enter)
6. Wait for success message: "Success. No rows returned"

### 3. Run RLS Policies
1. In SQL Editor, click **"New Query"** (or clear the editor)
2. Open the file: `packages/mobile/supabase/rls_policies.sql`
3. **Copy ALL the contents** from the file
4. **Paste** into the SQL Editor
5. Click **"Run"** button
6. Wait for success message

### 4. Verify Tables Created
1. In Supabase Dashboard, click **"Table Editor"** in the left sidebar
2. You should see these tables:
   - ✅ `users`
   - ✅ `groups`
   - ✅ `group_members`
   - ✅ `group_counters`
   - ✅ `juz_assignments`

### 5. Restart Your App
- Stop the Metro bundler (Ctrl+C)
- Restart with `npm start` or `yarn start`
- Reload the app

## If You Get Errors

### Error: "relation already exists"
- Tables already exist, skip to RLS policies

### Error: "permission denied"
- Make sure you're using the SQL Editor (has full permissions)
- Don't use the API directly for migrations

### Error: "syntax error"
- Make sure you copied the ENTIRE file
- Check for missing semicolons
- Try running each section separately

## Quick Copy Commands

If you want to see the SQL directly:

```bash
# View schema
cat packages/mobile/supabase/schema.sql

# View RLS policies  
cat packages/mobile/supabase/rls_policies.sql
```

## Verify Everything Works

### Test Connection Script
1. Open SQL Editor in Supabase
2. Open file: `packages/mobile/test-supabase-connection.sql`
3. Copy and paste into SQL Editor
4. Click "Run"
5. Check the results - all tests should pass

### Common Issues

#### Error PGRST125 Still Appears
**Possible causes:**
1. ✅ **RLS policies not run** - Run `rls_policies.sql`
2. ✅ **Tables in wrong schema** - Check Table Editor, tables should be in "public" schema
3. ✅ **API key issue** - Verify anon key in `lib/supabase.ts` matches Supabase dashboard
4. ✅ **Project URL wrong** - Verify URL in `lib/supabase.ts` matches Supabase dashboard

#### Check Your Supabase Settings
1. Go to: Settings → API
2. Verify:
   - Project URL: `https://trlgorbysnlastxucfsu.supabase.co`
   - Anon key: Should match `lib/supabase.ts`

#### Verify RLS Policies
In SQL Editor, run:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'groups');
```
Should show `rowsecurity = true` for all tables.

## Need Help?

1. Check the console logs - they show detailed error messages
2. Run the test connection script to verify setup
3. Check Supabase Dashboard → Table Editor - all 5 tables should be visible
4. Verify Settings → API - URL and key should match your code

