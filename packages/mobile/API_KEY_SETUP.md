# 🔑 API Key Setup - CRITICAL STEP

## ⚠️ You're Getting "Table Not Found" Because the API Key is Wrong!

The error `PGRST125: Invalid path` means Supabase can't find your tables. This happens when:
1. ❌ Wrong API key (wrong project)
2. ❌ Invalid API key format
3. ❌ API key not set

## ✅ Fix: Get Your Real Supabase Anon Key

### Step 1: Open Supabase Dashboard
Go to: https://trlgorbysnlastxucfsu.supabase.co

### Step 2: Get Your Anon Key
1. Click **Settings** (gear icon in left sidebar)
2. Click **API**
3. Find **"Project API keys"** section
4. Copy the **"anon/public"** key (NOT service_role!)

### Step 3: Update Your Code
Open `packages/mobile/lib/supabase.ts` and replace:

```typescript
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

With your actual key:

```typescript
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybGdvcmJ5c25sYXN0eHVjZnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMzQ1NjcsImV4cCI6MjAyNjgxMDU2N30.YOUR_ACTUAL_KEY_HERE';
```

### Step 4: Verify Key Format

✅ **Correct key:**
- Starts with `eyJ` (JWT token)
- 100+ characters long
- From Supabase dashboard

❌ **Wrong key:**
- Starts with `sb_publishable_` (Expo key)
- Starts with `sb_` (other Expo keys)
- Not from Supabase dashboard

## 🧪 Test Your Key

After updating, restart your app and check console logs:

✅ **Success:**
```
[Supabase] ✅ Connection test successful - users table accessible
```

❌ **Still failing:**
```
[Supabase] Connection test failed: PGRST125
```

If still failing:
1. Double-check you copied the **anon/public** key (not service_role)
2. Make sure there are no extra spaces
3. Verify the key matches Supabase dashboard exactly
4. Restart app with `npm start -- --reset-cache`

## 🔍 Why This Matters

- **Wrong key** → Requests go to wrong project → Tables not found
- **Right key** → Requests go to YOUR project → Tables found ✅

Your database is 100% ready - you just need the correct API key! 🚀

