// @ts-nocheck

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../utils/deviceId';

export type ActivityType = 'sholawat' | 'dua' | 'tasbih' | 'custom' | 'khatm';

export type User = {
  id: string;
  device_id: string;
  nickname: string;
  created_at: string;
};

export type Group = {
  id: string;
  title: string;
  purpose: string;
  activity_type: ActivityType;
  dhikr_phrase?: string | null;
  target_count?: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  user?: User;
};

export type GroupCounter = {
  id: string;
  group_id: string;
  user_id: string;
  count: number;
  message?: string | null;
  updated_at: string;
  user?: User;
};

export type JuzAssignment = {
  id: string;
  group_id: string;
  juz_number: number;
  taken_by_user?: string | null;
  taken_at?: string | null;
  user?: User;
};

type UmmahStore = {
  // User state
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Groups state
  groups: Group[];
  myGroups: Group[];
  selectedGroup: Group | null;
  groupMembers: GroupMember[];
  groupCounters: GroupCounter[];
  juzAssignments: JuzAssignment[];

  // Actions
  initializeUser: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  
  fetchGroups: () => Promise<void>;
  fetchMyGroups: () => Promise<void>;
  createGroup: (groupData: {
    title: string;
    purpose: string;
    activity_type: ActivityType;
    dhikr_phrase?: string;
    target_count?: number;
  }) => Promise<Group | null>;
  
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  
  fetchGroupDetails: (groupId: string) => Promise<void>;
  updateCounter: (groupId: string, count: number, message?: string) => Promise<void>;
  takeJuz: (groupId: string, juzNumber: number) => Promise<void>;
  releaseJuz: (groupId: string, juzNumber: number) => Promise<void>;
  
  subscribeToGroup: (groupId: string) => () => void;
  clearSelectedGroup: () => void;
};

export const useUmmahStore = create<UmmahStore>((set, get) => ({
  // Initial state
  user: null,
  isLoading: false,
  error: null,
  groups: [],
  myGroups: [],
  selectedGroup: null,
  groupMembers: [],
  groupCounters: [],
  juzAssignments: [],

  // Initialize user - check if exists, create if not
  initializeUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const deviceId = getDeviceId();
      console.log('[UmmahStore] Initializing user with device ID:', deviceId);

      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle not found gracefully

      if (fetchError) {
        // PGRST125 = Invalid path (table might not exist)
        // PGRST116 = Not found (expected for new users)
        if (fetchError.code === 'PGRST125') {
          console.error('[UmmahStore] Table "users" may not exist. Please run the database migrations:', {
            message: fetchError.message,
            code: fetchError.code,
            hint: 'Run packages/mobile/supabase/schema.sql in your Supabase SQL editor',
          });
          throw new Error('Database table "users" not found. Please run the database migrations in Supabase.');
        }
        
        if (fetchError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is expected for new users
          console.error('[UmmahStore] Error fetching user:', {
            message: fetchError.message,
            code: fetchError.code,
            details: fetchError.details,
            hint: fetchError.hint,
          });
          throw fetchError;
        }
      }

      if (existingUser) {
        console.log('[UmmahStore] Existing user found:', existingUser);
        set({ user: existingUser, isLoading: false });
        return;
      }

      // Create new user
      console.log('[UmmahStore] Creating new user...');
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            device_id: deviceId,
            nickname: `Guest${Math.floor(Math.random() * 10000)}`,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('[UmmahStore] Error creating user:', {
          message: createError.message,
          code: createError.code,
          details: createError.details,
          hint: createError.hint,
        });
        throw createError;
      }
      
      console.log('[UmmahStore] New user created:', newUser);
      set({ user: newUser, isLoading: false });
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to initialize user';
      console.error('[UmmahStore] Failed to initialize user:', {
        message: errorMessage,
        error: error,
      });
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Update user nickname
  updateNickname: async (nickname: string) => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ nickname })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      set({ user: data });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Fetch all groups
  fetchGroups: async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*, users:created_by(nickname)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch total counts for each group
      const groupIds = (data || []).map((g: any) => g.id);
      let totalCountsMap: Record<string, number> = {};
      
      if (groupIds.length > 0) {
        const { data: counters, error: countersError } = await supabase
          .from('group_counters')
          .select('group_id, count')
          .in('group_id', groupIds);

        if (countersError) {
          console.error('[UmmahStore] Error fetching counters:', countersError);
        } else if (counters) {
          // Calculate total count per group
          totalCountsMap = counters.reduce((acc: Record<string, number>, counter: any) => {
            const groupId = counter.group_id;
            acc[groupId] = (acc[groupId] || 0) + (counter.count || 0);
            return acc;
          }, {});
          console.log('[UmmahStore] Total counts calculated:', totalCountsMap);
        }
      }
      
      // Map the data to include creator nickname and total count
      const groupsWithCreator = (data || []).map((group: any) => ({
        ...group,
        creator_nickname: group.users?.nickname || 'Unknown',
        total_count: totalCountsMap[group.id] || 0,
      }));
      
      set({ groups: groupsWithCreator });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Fetch user's groups
  fetchMyGroups: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*, users:created_by(nickname))')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const myGroupsRaw = (data || [])
        .map((item: any) => item.groups)
        .filter(Boolean);
      
      // Fetch total counts for each group
      const groupIds = myGroupsRaw.map((g: any) => g.id);
      let totalCountsMap: Record<string, number> = {};
      
      if (groupIds.length > 0) {
        const { data: counters, error: countersError } = await supabase
          .from('group_counters')
          .select('group_id, count')
          .in('group_id', groupIds);

        if (countersError) {
          console.error('[UmmahStore] Error fetching counters for my groups:', countersError);
        } else if (counters) {
          // Calculate total count per group
          totalCountsMap = counters.reduce((acc: Record<string, number>, counter: any) => {
            const groupId = counter.group_id;
            acc[groupId] = (acc[groupId] || 0) + (counter.count || 0);
            return acc;
          }, {});
          console.log('[UmmahStore] Total counts for my groups calculated:', totalCountsMap);
        }
      }
      
      const myGroups = myGroupsRaw.map((group: any) => ({
        ...group,
        creator_nickname: group.users?.nickname || 'Unknown',
        total_count: totalCountsMap[group.id] || 0,
      }));
      
      set({ myGroups });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Create a new group
  createGroup: async (groupData) => {
    const { user } = get();
    if (!user) {
      console.error('[UmmahStore] Cannot create group: No user found');
      set({ error: 'No user found. Please try again.' });
      return null;
    }

    try {
      const insertData = {
        ...groupData,
        created_by: user.id,
      };
      
      console.log('[UmmahStore] Creating group with data:', JSON.stringify(insertData, null, 2));

      const { data, error } = await supabase
        .from('groups')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('[UmmahStore] Supabase error creating group:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      console.log('[UmmahStore] Group created successfully:', data);
      
      // If data is null but no error, the insert succeeded but select failed
      // Try fetching the group by created_by and title as fallback
      if (!data) {
        console.warn('[UmmahStore] Group insert succeeded but select returned null. Fetching by title...');
        const { data: fetchedData, error: fetchError } = await supabase
          .from('groups')
          .select('*')
          .eq('created_by', user.id)
          .eq('title', insertData.title)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (fetchError || !fetchedData) {
          console.error('[UmmahStore] Failed to fetch created group:', fetchError);
          throw new Error('Group created but could not retrieve it. Please refresh the list.');
        }
        
        console.log('[UmmahStore] Fetched group after creation:', fetchedData);
        
        // Handle case where fetchedData might be an array (check logs - it's showing as array)
        const groupData = Array.isArray(fetchedData) ? fetchedData[0] : fetchedData;
        
        if (!groupData || !groupData.id) {
          console.error('[UmmahStore] Fetched group but data is invalid:', { 
            fetchedData, 
            isArray: Array.isArray(fetchedData),
            groupData,
            hasId: groupData?.id
          });
          throw new Error('Group created but could not retrieve it. Please refresh the list.');
        }
        
        console.log('[UmmahStore] Using group data with id:', groupData.id);
        
        // Auto-join the creator to the group
        try {
          await get().joinGroup(groupData.id);
          console.log('[UmmahStore] User joined group successfully');
        } catch (joinError: any) {
          console.warn('[UmmahStore] Error joining group (non-fatal):', joinError?.message || joinError);
        }
        
        // Refresh groups
        try {
          await get().fetchGroups();
        } catch (fetchError: any) {
          console.warn('[UmmahStore] Error fetching groups (non-fatal):', fetchError?.message || fetchError);
        }
        
        // Return the group data
        return groupData;
      }

      // Auto-join the creator to the group
      try {
        await get().joinGroup(data.id);
        console.log('[UmmahStore] User joined group successfully');
      } catch (joinError: any) {
        console.warn('[UmmahStore] Error joining group (non-fatal):', joinError?.message || joinError);
        // Continue even if join fails
      }

      // Refresh groups
      try {
        await get().fetchGroups();
      } catch (fetchError: any) {
        console.warn('[UmmahStore] Error fetching groups (non-fatal):', fetchError?.message || fetchError);
        // Continue even if fetch fails
      }
      
      return data;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      const errorDetails = error?.details || '';
      const errorHint = error?.hint || '';
      const errorCode = error?.code || '';
      
      console.error('[UmmahStore] Failed to create group:', {
        message: errorMessage,
        details: errorDetails,
        hint: errorHint,
        code: errorCode,
        fullError: JSON.stringify(error, null, 2),
      });
      
      const displayMessage = errorMessage + 
        (errorDetails ? `\n\nDetails: ${errorDetails}` : '') +
        (errorHint ? `\n\nHint: ${errorHint}` : '') +
        (errorCode ? `\n\nCode: ${errorCode}` : '');
      
      set({ 
        error: displayMessage || 'Failed to create group. Please check your connection and try again.',
        isLoading: false 
      });
      
      return null;
    }
  },

  // Join a group
  joinGroup: async (groupId: string) => {
    const { user } = get();
    if (!user) {
      console.warn('[UmmahStore] Cannot join group: No user found');
      return;
    }

    if (!groupId) {
      console.error('[UmmahStore] Cannot join group: groupId is undefined');
      return;
    }

    try {
      console.log('[UmmahStore] Joining group:', groupId);
      const { error } = await supabase
        .from('group_members')
        .insert([
          {
            group_id: groupId,
            user_id: user.id,
          },
        ]);

      if (error && error.code !== '23505') {
        console.error('[UmmahStore] Error joining group:', error);
        throw error;
      }
      
      console.log('[UmmahStore] Successfully joined group, fetching details...');
      await get().fetchGroupDetails(groupId);
      await get().fetchMyGroups();
    } catch (error: any) {
      console.error('[UmmahStore] Error in joinGroup:', error);
      set({ error: error.message });
    }
  },

  // Leave a group
  leaveGroup: async (groupId: string) => {
    const { user } = get();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      await get().fetchMyGroups();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Fetch full group details
  fetchGroupDetails: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('[UmmahStore] Fetching group details for:', groupId);
      
      // Fetch group
      console.log('[UmmahStore] Fetching group from Supabase:', groupId);
      
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      console.log('[UmmahStore] Supabase response:', {
        hasData: !!group,
        dataType: typeof group,
        isArray: Array.isArray(group),
        data: group,
        error: groupError,
      });

      if (groupError) {
        console.error('[UmmahStore] Error fetching group:', {
          message: groupError.message,
          code: groupError.code,
          details: groupError.details,
          hint: groupError.hint,
        });
        throw groupError;
      }

      // Handle case where group might be an array (even with .single())
      // Also handle case where group is null/undefined
      if (!group) {
        console.error('[UmmahStore] Group query returned null/undefined:', {
          groupId,
          groupError,
        });
        throw new Error('Group not found');
      }

      const groupData = Array.isArray(group) ? group[0] : group;

      console.log('[UmmahStore] After array extraction:', {
        originalGroup: group,
        groupData,
        hasId: !!groupData?.id,
        id: groupData?.id,
      });

      if (!groupData || !groupData.id) {
        console.error('[UmmahStore] Group not found or invalid:', {
          groupId,
          group,
          isArray: Array.isArray(group),
          groupData,
          hasId: !!groupData?.id,
          keys: groupData ? Object.keys(groupData) : [],
        });
        throw new Error('Group not found');
      }

      console.log('[UmmahStore] Group fetched successfully:', {
        id: groupData.id,
        title: groupData.title,
        activityType: groupData.activity_type,
      });

      // Fetch members with user details
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('*, users(*)')
        .eq('group_id', groupId);

      if (membersError) {
        console.error('[UmmahStore] Error fetching members:', membersError);
        throw membersError;
      }

      console.log('[UmmahStore] Members fetched:', members?.length || 0);

      // Fetch counters with user details
      const { data: counters, error: countersError } = await supabase
        .from('group_counters')
        .select('*, users(*)')
        .eq('group_id', groupId)
        .order('count', { ascending: false });

      if (countersError) {
        console.error('[UmmahStore] Error fetching counters:', countersError);
        throw countersError;
      }

      console.log('[UmmahStore] Counters fetched:', counters?.length || 0);

      // Fetch juz assignments if khatm
      let juzAssignments: JuzAssignment[] = [];
      if (groupData.activity_type === 'khatm') {
        const { data: juz, error: juzError } = await supabase
          .from('juz_assignments')
          .select('*, users(*)')
          .eq('group_id', groupId)
          .order('juz_number', { ascending: true });

        if (juzError) {
          console.error('[UmmahStore] Error fetching juz assignments:', juzError);
          throw juzError;
        }
        juzAssignments = juz || [];
        console.log('[UmmahStore] Juz assignments fetched:', juzAssignments.length);
      }

      const groupMembersMapped = (members || []).map((m: any) => ({
        ...m,
        user: m.users,
      }));
      
      const groupCountersMapped = (counters || []).map((c: any) => ({
        ...c,
        user: c.users,
      }));
      
      const juzAssignmentsMapped = (juzAssignments || []).map((j: any) => ({
        ...j,
        user: j.users,
      }));

      console.log('[UmmahStore] Setting state with group:', {
        groupId: groupData.id,
        hasActivityType: !!groupData.activity_type,
        activityType: groupData.activity_type,
        membersCount: groupMembersMapped.length,
        countersCount: groupCountersMapped.length,
        juzCount: juzAssignmentsMapped.length,
      });

      // Ensure selectedGroup is a single object, not an array
      // Double-check groupData is not an array before setting
      const finalGroupData = Array.isArray(groupData) ? groupData[0] : groupData;
      
      if (!finalGroupData || !finalGroupData.id) {
        console.error('[UmmahStore] Final groupData is invalid:', {
          groupData,
          finalGroupData,
          isArray: Array.isArray(groupData),
        });
        throw new Error('Group data is invalid');
      }
      
      // Final validation - ensure finalGroupData is a plain object, not an array
      const validatedGroupData = Array.isArray(finalGroupData) 
        ? finalGroupData[0] 
        : finalGroupData;
      
      if (!validatedGroupData || !validatedGroupData.id || Array.isArray(validatedGroupData)) {
        console.error('[UmmahStore] Validated groupData is still invalid:', {
          finalGroupData,
          validatedGroupData,
          isArray: Array.isArray(validatedGroupData),
          hasId: !!validatedGroupData?.id,
        });
        throw new Error('Group data validation failed');
      }
      
      console.log('[UmmahStore] Setting state with validatedGroupData:', {
        id: validatedGroupData.id,
        title: validatedGroupData.title,
        activityType: validatedGroupData.activity_type,
        isArray: Array.isArray(validatedGroupData),
        type: typeof validatedGroupData,
      });
      
      // Create a clean object to ensure it's not an array or has extra properties
      const cleanGroupData: Group = {
        id: validatedGroupData.id,
        title: validatedGroupData.title,
        purpose: validatedGroupData.purpose,
        activity_type: validatedGroupData.activity_type,
        dhikr_phrase: validatedGroupData.dhikr_phrase || null,
        target_count: validatedGroupData.target_count || null,
        created_by: validatedGroupData.created_by,
        created_at: validatedGroupData.created_at,
        updated_at: validatedGroupData.updated_at,
      };
      
      set({
        selectedGroup: cleanGroupData, // Ensure it's always a clean single object
        groupMembers: groupMembersMapped,
        groupCounters: groupCountersMapped,
        juzAssignments: juzAssignmentsMapped,
        isLoading: false,
        error: null,
      });

      console.log('[UmmahStore] Group details loaded successfully. State updated with:', {
        selectedGroupId: cleanGroupData.id,
        selectedGroupTitle: cleanGroupData.title,
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load group details';
      console.error('[UmmahStore] Error in fetchGroupDetails:', errorMessage, error);
      set({ 
        error: errorMessage,
        isLoading: false,
        selectedGroup: null,
      });
    }
  },

  // Update counter for a group
  updateCounter: async (groupId: string, count: number, message?: string) => {
    const { user } = get();
    if (!user) {
      console.error('[UmmahStore] Cannot update counter: No user found');
      throw new Error('User not initialized');
    }

    try {
      console.log('[UmmahStore] Updating counter:', {
        groupId,
        userId: user.id,
        count,
        message,
      });

      // First, check if a counter already exists for this user and group
      const { data: existingCounter, error: checkError } = await supabase
        .from('group_counters')
        .select('id, count')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('[UmmahStore] Error checking existing counter:', checkError);
        throw checkError;
      }

      let result;
      if (existingCounter) {
        // Update existing counter
        console.log('[UmmahStore] Updating existing counter:', existingCounter.id);
        const updateResult = await supabase
          .from('group_counters')
          .update({
            count,
            message: message || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCounter.id)
          .select();
        
        if (updateResult.error) {
          console.error('[UmmahStore] Error updating counter:', updateResult.error);
          throw updateResult.error;
        }
        result = updateResult.data;
        console.log('[UmmahStore] Counter updated successfully:', result);
      } else {
        // Insert new counter
        console.log('[UmmahStore] Creating new counter');
        const insertResult = await supabase
          .from('group_counters')
          .insert({
            group_id: groupId,
            user_id: user.id,
            count,
            message: message || null,
            updated_at: new Date().toISOString(),
          })
          .select();
        
        if (insertResult.error) {
          console.error('[UmmahStore] Error creating counter:', insertResult.error);
          throw insertResult.error;
        }
        result = insertResult.data;
        console.log('[UmmahStore] Counter created successfully:', result);
      }

      // Refresh group details and groups lists to show updated count
      await Promise.all([
        get().fetchGroupDetails(groupId),
        get().fetchGroups(),
        get().fetchMyGroups(),
      ]);
      
      console.log('[UmmahStore] Groups refreshed after counter update');
    } catch (error: any) {
      console.error('[UmmahStore] Failed to update counter:', error);
      set({ error: error.message });
      throw error;
    }
  },

  // Take a Juz
  takeJuz: async (groupId: string, juzNumber: number) => {
    const { user } = get();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('juz_assignments')
        .update({
          taken_by_user: user.id,
          taken_at: new Date().toISOString(),
        })
        .eq('group_id', groupId)
        .eq('juz_number', juzNumber);

      if (error) throw error;
      
      await get().fetchGroupDetails(groupId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Release a Juz
  releaseJuz: async (groupId: string, juzNumber: number) => {
    const { user } = get();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('juz_assignments')
        .update({
          taken_by_user: null,
          taken_at: null,
        })
        .eq('group_id', groupId)
        .eq('juz_number', juzNumber)
        .eq('taken_by_user', user.id);

      if (error) throw error;
      
      await get().fetchGroupDetails(groupId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Subscribe to group changes
  subscribeToGroup: (groupId: string) => {
    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_counters',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          get().fetchGroupDetails(groupId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'juz_assignments',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          get().fetchGroupDetails(groupId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Clear selected group
  clearSelectedGroup: () => {
    set({
      selectedGroup: null,
      groupMembers: [],
      groupCounters: [],
      juzAssignments: [],
    });
  },
}));

