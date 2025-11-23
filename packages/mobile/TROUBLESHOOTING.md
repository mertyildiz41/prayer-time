# Troubleshooting Guide

## ✅ Database Setup Complete!

Your test results show:
- ✅ All 5 tables exist
- ✅ RLS enabled on all tables  
- ✅ All policies in place (16 policies)
- ✅ Test insert/select working

## If App Still Shows Errors

### 1. **Restart Your App**
```bash
# Stop Metro bundler (Ctrl+C)
# Then restart
npm start
# or
yarn start

# Reload app on device/simulator
```

### 2. **Clear Metro Cache**
```bash
npm start -- --reset-cache
# or
yarn start --reset-cache
```

### 3. **Verify Supabase Settings**

Check `packages/mobile/lib/supabase.ts`:

```typescript
const SUPABASE_URL = 'https://trlgorbysnlastxucfsu.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

**To get your anon key:**
1. Go to: https://trlgorbysnlastxucfsu.supabase.co
2. Click **Settings** → **API**
3. Copy **"anon/public"** key
4. Paste in `lib/supabase.ts`

### 4. **Check Console Logs**

After restarting, look for:
- `[Supabase] ✅ Connection test successful`
- `[UmmahStore] Existing user found` or `[UmmahStore] New user created`

### 5. **Test Connection Directly**

In your app console, you should see:
```
[Supabase] Client initialized: { url: "...", hasKey: true, keyLength: 46 }
[Supabase] ✅ Connection test successful - users table accessible
```

If you see `Connection test failed`:
- Check your anon key matches Supabase dashboard
- Check your Supabase URL is correct
- Check your network connection

### 6. **Verify Anon Key Format**

The anon key should:
- Start with `eyJ` (JWT token)
- Be 100+ characters long
- Match exactly what's in Supabase dashboard

### Common Issues

#### Still Getting PGRST125 Error
- ✅ Restart app with cache reset
- ✅ Verify anon key is correct
- ✅ Check Supabase URL matches exactly

#### App Works But Can't Create User
- ✅ Check RLS policies allow INSERT
- ✅ Verify policies are active (you already did this ✅)

#### Connection Test Fails
- ✅ Check internet connection
- ✅ Verify Supabase project is active (not paused)
- ✅ Try opening Supabase dashboard in browser

## Next Steps

1. **Restart app** with `npm start -- --reset-cache`
2. **Reload app** on device/simulator
3. **Check console logs** for connection success message
4. **Try creating a group** - should work now!

Your database is 100% ready - just need to ensure the app connects properly! 🚀


