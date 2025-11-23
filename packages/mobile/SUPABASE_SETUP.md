# Supabase Setup Guide

## 🔥 Quick Setup Steps

### 1. Get Your Supabase Anon Key

1. Go to your Supabase project: https://trlgorbysnlastxucfsu.supabase.co
2. Navigate to **Settings** → **API**
3. Copy your **anon/public** key
4. Replace `YOUR_SUPABASE_ANON_KEY` in `packages/mobile/lib/supabase.ts`

### 2. Run Database Migrations

1. Go to **SQL Editor** in Supabase Dashboard
2. Run the schema SQL: `packages/mobile/supabase/schema.sql`
3. Run the RLS policies: `packages/mobile/supabase/rls_policies.sql`

### 3. Install Dependencies

```bash
cd packages/mobile
npm install @supabase/supabase-js zustand
# or
yarn add @supabase/supabase-js zustand
```

### 4. Update Supabase Client

Edit `packages/mobile/lib/supabase.ts` and replace `YOUR_SUPABASE_ANON_KEY` with your actual anon key.

## 📋 Database Schema Summary

The app creates 5 tables:

1. **users** - Device-based user accounts
2. **groups** - Purpose-based worship groups
3. **group_members** - Group membership
4. **group_counters** - User contributions (counts)
5. **juz_assignments** - Juz assignments for Khatm Qur'an

## 🔒 Security (RLS)

All tables have Row Level Security enabled:
- Groups are publicly readable (like prayer groups)
- Users can only update their own counters
- Group members can take/release Juz
- No sensitive data stored

## 🚀 Next Steps

After setup:
1. Add Ummah route to navigation in `App.tsx`
2. Add translations for all new screens
3. Test the app with real Supabase connection

## 📝 Important Notes

- RLS policies use `auth.uid()` but we're using device-based auth
- You may need to adjust RLS policies for device-based authentication
- Consider creating a service role function for device ID verification

