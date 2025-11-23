# Purpose-Based Worship App - Implementation Guide

## ✅ Completed Setup

### 1. Ummah Navigation Button ✓
- Added "Ummah" button to bottom navigation
- Added translations in EN, TR, ID
- Updated navigation types and routes

### 2. Supabase Setup ✓
- Created Supabase client configuration (`lib/supabase.ts`)
- **⚠️ IMPORTANT**: Replace `YOUR_SUPABASE_ANON_KEY` with your actual anon key from Supabase dashboard

### 3. Database Schema ✓
- Complete SQL schema (`supabase/schema.sql`)
- Tables: users, groups, group_members, group_counters, juz_assignments
- Auto-triggers for khatm initialization and counter creation

### 4. RLS Policies ✓
- Row Level Security policies (`supabase/rls_policies.sql`)
- Public group access, user-specific counter updates
- **⚠️ NOTE**: May need adjustment for device-based auth

### 5. Core Utilities ✓
- Device ID generation (`utils/deviceId.ts`)
- Zustand store (`store/ummahStore.ts`) - Complete state management

### 6. Main Screens Created ✓
- Ummah Home Screen (`pages/UmmahScreen.tsx`)
- Create Group Screen (`pages/CreateGroupScreen.tsx`)

## 📋 Next Steps - Remaining Screens

### 1. Group Detail Screen
Create `packages/mobile/pages/GroupDetailScreen.tsx`:
- Show group purpose and details
- Counter mode: Progress ring, member contributions
- Khatm mode: 30 Juz grid with colors
- "Join & Start Reading" button

### 2. Counter Screen
Create `packages/mobile/pages/CounterScreen.tsx`:
- Full-screen dhikr phrase display
- Large circular counter button
- Tap to increment
- "Send My Good Intention" button with optional message

### 3. Completion Screen
Create `packages/mobile/pages/CompletionScreen.tsx`:
- Success animation
- "May Allah accept your worship" message
- Return to group button

### 4. Juz Selection Screen (Khatm)
- Grid of 30 Juz
- Color coding: gray (available), green (yours), orange (taken)
- Tap to take/release Juz

## 🚀 Setup Instructions

### Step 1: Install Dependencies
```bash
cd packages/mobile
npm install @supabase/supabase-js zustand
# or
yarn add @supabase/supabase-js zustand
```

### Step 2: Get Supabase Anon Key
1. Go to https://trlgorbysnlastxucfsu.supabase.co
2. Settings → API
3. Copy the `anon/public` key

### Step 3: Update Supabase Client
Edit `packages/mobile/lib/supabase.ts`:
```typescript
const SUPABASE_ANON_KEY = 'your-actual-anon-key-here';
```

### Step 4: Run Database Migrations
1. Open Supabase Dashboard → SQL Editor
2. Run `packages/mobile/supabase/schema.sql`
3. Run `packages/mobile/supabase/rls_policies.sql`

### Step 5: Add Remaining Routes
Add to `App.tsx`:
```typescript
import CreateGroupScreen from './pages/CreateGroupScreen';
import GroupDetailScreen from './pages/GroupDetailScreen';
import CounterScreen from './pages/CounterScreen';
import CompletionScreen from './pages/CompletionScreen';

// In Stack.Navigator:
<Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ headerShown: false }} />
<Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ headerShown: false }} />
<Stack.Screen name="Counter" component={CounterScreen} options={{ headerShown: false }} />
<Stack.Screen name="Completion" component={CompletionScreen} options={{ headerShown: false }} />
```

## 🔧 Important Notes

1. **RLS Policies**: Current RLS uses `auth.uid()` but we're using device-based auth. You may need to:
   - Create a Supabase function to verify device_id
   - Adjust RLS policies to use device_id instead of auth.uid()
   - Or use service role key for server-side operations

2. **Real-time Subscriptions**: The store includes `subscribeToGroup()` for real-time updates

3. **Offline Support**: Consider adding `expo-sqlite` for offline counter storage

4. **Error Handling**: Add proper error messages and retry logic

## 📱 Screen Flow

1. **Ummah Home** → Create Group / View Groups
2. **Create Group** → Fill form → Creates group → **Group Detail**
3. **Group Detail** → Join Group → **Counter** (for sholawat/dua/tasbih/custom)
4. **Group Detail** → Select Juz (for khatm) → **Counter**
5. **Counter** → Tap to count → Send → **Completion**
6. **Completion** → Return to **Group Detail**

## 🎨 UI Style

- Background: `#0a0e1a` (dark blue)
- Primary: `#38bdf8` (sky blue)
- Text: `#ffffff` (white) / `#94a3b8` (gray)
- Cards: `rgba(15, 23, 42, 0.75)` with rounded corners (16-24px)
- Use Noto Sans Arabic for Arabic text

