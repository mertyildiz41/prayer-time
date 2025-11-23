// @ts-nocheck

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-icons';
import Slider from '@react-native-community/slider';
import { RootStackParamList } from '../navigation/types';
import { useUmmahStore, ActivityType } from '../store/ummahStore';
import { useTranslation } from '../i18n';

type CreateGroupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const ACTIVITY_TYPES: { type: ActivityType; label: string; icon: string; subtitle: string }[] = [
  { type: 'sholawat', label: 'Sholawat', icon: 'star', subtitle: 'Peace upon Prophet' },
  { type: 'dua', label: 'Dua', icon: 'favorite', subtitle: 'Supplication to God' },
  { type: 'tasbih', label: 'Tasbih / Dhikr', icon: 'mood', subtitle: 'Remembrance' },
  { type: 'khatm', label: 'Khatm Qur\'an', icon: 'menu-book', subtitle: 'Complete reading' },
  { type: 'custom', label: 'Custom Dhikr', icon: 'add-circle', subtitle: 'Create your own' },
];

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { createGroup, error: storeError, user, initializeUser, isLoading } = useUmmahStore();

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('sholawat');
  const [dhikrPhrase, setDhikrPhrase] = useState('');
  const [targetCount, setTargetCount] = useState(1000);
  const [customTargetCount, setCustomTargetCount] = useState('');
  const [useCustomTarget, setUseCustomTarget] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Ensure user is initialized when screen mounts (only once)
  React.useEffect(() => {
    let mounted = true;
    const ensureUser = async () => {
      if (!user && !isLoading && mounted) {
        console.log('[CreateGroupScreen] No user found, initializing...');
        try {
          await initializeUser();
        } catch (error: any) {
          console.error('[CreateGroupScreen] Failed to initialize user:', error);
          // Don't retry on error - let user handle it manually
        }
      }
    };
    ensureUser();
    
    return () => {
      mounted = false;
    };
  }, []); // Only run once on mount

  const handleCreate = async () => {
    // Ensure user exists before creating group
    if (!user) {
      console.log('[CreateGroupScreen] User not found, initializing...');
      setIsCreating(true);
      try {
        await initializeUser();
        // Check again after initialization
        const updatedUser = useUmmahStore.getState().user;
        if (!updatedUser) {
          setIsCreating(false);
          Alert.alert(
            t('ummah.createGroupError'),
            'Unable to initialize user. Please try again.'
          );
          return;
        }
      } catch (error: any) {
        setIsCreating(false);
        console.error('[CreateGroupScreen] Error initializing user:', error);
        Alert.alert(
          t('ummah.createGroupError'),
          `Failed to initialize user: ${error?.message || 'Unknown error'}`
        );
        return;
      }
    }

    if (!title.trim() || !purpose.trim()) {
      Alert.alert(t('ummah.createGroupError'), t('ummah.fillAllFields'));
      return;
    }

    if ((activityType === 'dua' || activityType === 'custom') && !dhikrPhrase.trim()) {
      Alert.alert(t('ummah.createGroupError'), t('ummah.enterDhikrPhrase'));
      return;
    }

    setIsCreating(true);
    
    const groupData: any = {
      title: title.trim(),
      purpose: purpose.trim(),
      activity_type: activityType,
    };

    if (activityType === 'khatm') {
      // Khatm doesn't need target count
    } else {
      // Use custom target if set, otherwise use slider value
      let finalTarget = targetCount;
      if (useCustomTarget && customTargetCount.trim()) {
        const parsed = parseInt(customTargetCount.replace(/,/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= Number.MAX_SAFE_INTEGER) {
          finalTarget = parsed;
        } else {
          Alert.alert(t('ummah.createGroupError'), t('ummah.invalidTargetCount'));
          setIsCreating(false);
          return;
        }
      } else {
        // Validate slider value
        if (isNaN(targetCount) || targetCount < 100 || targetCount > 100000) {
          Alert.alert(t('ummah.createGroupError'), t('ummah.invalidTargetCount'));
          setIsCreating(false);
          return;
        }
        finalTarget = Math.round(targetCount);
      }
      groupData.target_count = finalTarget;
    }

    if (activityType === 'dua' || activityType === 'custom') {
      groupData.dhikr_phrase = dhikrPhrase.trim();
    } else if (activityType === 'sholawat') {
      groupData.dhikr_phrase = 'اللهم صل على محمد';
    } else if (activityType === 'tasbih') {
      groupData.dhikr_phrase = 'سبحان الله';
    }

    console.log('[CreateGroupScreen] Attempting to create group with data:', JSON.stringify(groupData, null, 2));
    
    const group = await createGroup(groupData);
    setIsCreating(false);

    if (group) {
      console.log('[CreateGroupScreen] Group created successfully, navigating to group detail');
      // Clear any previous errors
      useUmmahStore.getState().error = null;
      navigation.navigate('GroupDetail', { groupId: group.id });
    } else {
      // Get error from store
      const currentError = useUmmahStore.getState().error || storeError || t('ummah.createGroupFailed');
      
      console.error('[CreateGroupScreen] Failed to create group. Error from store:', currentError);
      console.error('[CreateGroupScreen] Full error object:', JSON.stringify(useUmmahStore.getState().error, null, 2));
      
      Alert.alert(
        t('ummah.createGroupError'), 
        String(currentError),
        [
          { text: 'OK', style: 'default', onPress: () => {
            // Clear error after showing
            useUmmahStore.getState().error = null;
          }},
        ]
      );
    }
  };

  const selectedActivity = ACTIVITY_TYPES.find((a) => a.type === activityType);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('ummah.createGroup')}</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Title */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('ummah.groupTitle')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('ummah.groupTitlePlaceholder')}
            placeholderTextColor="#64748b"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Purpose/Niyyah */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('ummah.purpose')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('ummah.purposePlaceholder')}
            placeholderTextColor="#64748b"
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Activity Type */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>{t('ummah.chooseActivity')}</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_TYPES.map((activity) => (
              <TouchableOpacity
                key={activity.type}
                style={[
                  styles.activityCard,
                  activityType === activity.type && styles.activityCardSelected,
                ]}
                onPress={() => setActivityType(activity.type)}
                activeOpacity={0.8}
              >
                <Icon
                  name={activity.icon as any}
                  size={24}
                  color={activityType === activity.type ? '#38bdf8' : '#64748b'}
                />
                <Text
                  style={[
                    styles.activityLabel,
                    activityType === activity.type && styles.activityLabelSelected,
                  ]}
                >
                  {activity.label}
                </Text>
                <Text
                  style={[
                    styles.activitySubtitle,
                    activityType === activity.type && styles.activitySubtitleSelected,
                  ]}
                >
                  {activity.subtitle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dhikr Phrase (for dua/custom) */}
        {(activityType === 'dua' || activityType === 'custom') && (
          <View style={styles.inputSection}>
            <Text style={styles.label}>{t('ummah.dhikrPhrase')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('ummah.dhikrPhrasePlaceholder')}
              placeholderTextColor="#64748b"
              value={dhikrPhrase}
              onChangeText={setDhikrPhrase}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Target Count (not for khatm) */}
        {activityType !== 'khatm' && (
          <View style={styles.inputSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.label}>{t('ummah.setTargetCount')}</Text>
              <TouchableOpacity
                onPress={() => setUseCustomTarget(!useCustomTarget)}
                style={styles.customToggle}
              >
                <Text style={styles.customToggleText}>
                  {useCustomTarget ? t('ummah.useSlider') : t('ummah.customTarget')}
                </Text>
              </TouchableOpacity>
            </View>
            
            {useCustomTarget ? (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder={t('ummah.customTargetPlaceholder')}
                  placeholderTextColor="#64748b"
                  value={customTargetCount}
                  onChangeText={(text) => {
                    // Allow only numbers and commas
                    const cleaned = text.replace(/[^\d,]/g, '');
                    setCustomTargetCount(cleaned);
                  }}
                  keyboardType="numeric"
                />
                <Text style={styles.inputHint}>
                  {t('ummah.noLimit')}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.sliderHeader}>
                  <Text style={styles.targetValue}>
                    {isNaN(targetCount) ? '1000' : targetCount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderMin}>100</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={100}
                    maximumValue={100000}
                    value={isNaN(targetCount) ? 1000 : Math.max(100, Math.min(100000, targetCount))}
                    onValueChange={(value) => {
                      const numValue = Math.round(value);
                      if (!isNaN(numValue) && numValue >= 100) {
                        setTargetCount(numValue);
                      }
                    }}
                    step={100}
                    minimumTrackTintColor="#38bdf8"
                    maximumTrackTintColor="#334155"
                    thumbTintColor="#38bdf8"
                  />
                  <Text style={styles.sliderMax}>100,000</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Loading indicator if user is initializing */}
        {isLoading && !user && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>{t('ummah.initializing')}</Text>
          </View>
        )}

        {/* Create Button */}
        <TouchableOpacity
          style={[
            styles.createButton, 
            (isCreating || isLoading || !user) && styles.createButtonDisabled
          ]}
          onPress={handleCreate}
          disabled={isCreating || isLoading || !user}
          activeOpacity={0.8}
        >
          {isCreating ? (
            <ActivityIndicator color="#ffffff" />
          ) : !user ? (
            <Text style={styles.createButtonText}>{t('ummah.initializing')}</Text>
          ) : (
            <Text style={styles.createButtonText}>{t('ummah.createGroup')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    width: '48%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  activityCardSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  activityLabelSelected: {
    color: '#38bdf8',
  },
  activitySubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  activitySubtitleSelected: {
    color: '#94a3b8',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  targetValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#38bdf8',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderMin: {
    fontSize: 12,
    color: '#64748b',
    width: 40,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMax: {
    fontSize: 12,
    color: '#64748b',
    width: 60,
    textAlign: 'right',
  },
  customToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  customToggleText: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '600',
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  createButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default CreateGroupScreen;

