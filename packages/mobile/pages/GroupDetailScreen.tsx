// @ts-nocheck

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-icons';
import { RootStackParamList } from '../navigation/types';
import { useUmmahStore } from '../store/ummahStore';
import { useTranslation } from '../i18n';
import { formatRelativeTime } from '../utils/relativeTime';
import CircularProgress from '../components/CircularProgress';

type GroupDetailScreenRouteProp = RouteProp<RootStackParamList, 'GroupDetail'>;

const GroupDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<GroupDetailScreenRouteProp>();
  const { t } = useTranslation();
  
  // Safely get groupId from route params
  const groupId = route.params?.groupId;
  
  console.log('[GroupDetailScreen] Route params:', route.params);
  console.log('[GroupDetailScreen] GroupId from params:', groupId);

  const {
    selectedGroup,
    groupMembers,
    groupCounters,
    juzAssignments,
    user,
    isLoading,
    error,
    fetchGroupDetails,
    joinGroup,
    updateCounter,
  } = useUmmahStore();

  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    console.log('[GroupDetailScreen] useEffect triggered, groupId:', groupId);
    if (groupId) {
      console.log('[GroupDetailScreen] Loading group:', groupId);
      fetchGroupDetails(groupId);
    } else {
      console.error('[GroupDetailScreen] No groupId provided in route params!');
      console.error('[GroupDetailScreen] Route params:', route.params);
    }
  }, [groupId]);

  // Debug: Log state changes - this will show us what the component sees
  useEffect(() => {
    console.log('[GroupDetailScreen] State update:', {
      isLoading,
      hasSelectedGroup: !!selectedGroup,
      selectedGroupId: selectedGroup?.id,
      activityType: selectedGroup?.activity_type,
      error,
      fullSelectedGroup: selectedGroup ? JSON.stringify(selectedGroup, null, 2) : null,
    });
  }, [isLoading, selectedGroup, error]);
  
  // Also log on every render
  console.log('[GroupDetailScreen] Render check:', {
    isLoading,
    hasSelectedGroup: !!selectedGroup,
    selectedGroupId: selectedGroup?.id,
    groupId,
    shouldShowLoading: isLoading || !selectedGroup || !selectedGroup?.activity_type,
  });

  // Clear selected group when leaving screen
  useEffect(() => {
    return () => {
      // Don't clear on unmount - keep for navigation back
    };
  }, []);

  // Handle case where selectedGroup might be an array (from Supabase response)
  // Extract the actual group object from array if needed
  const groupData = selectedGroup 
    ? (Array.isArray(selectedGroup) ? selectedGroup[0] : selectedGroup)
    : null;
  
  const isMember = groupMembers.some((m) => m.user_id === user?.id);
  const userCounter = groupCounters.find((c) => c.user_id === user?.id);
  const totalCount = groupCounters.reduce((sum, c) => sum + c.count, 0);
  const progress = groupData?.target_count
    ? (totalCount / groupData.target_count) * 100
    : 0;

  const handleJoinGroup = async () => {
    if (!user) {
      Alert.alert('Error', 'Please initialize your profile first');
      return;
    }

    if (isMember) {
      // Already a member, navigate to counter screen
      navigation.navigate('Counter', { groupId });
      return;
    }

    setIsJoining(true);
    try {
      await joinGroup(groupId);
      navigation.navigate('Counter', { groupId });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to join group');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartCounting = () => {
    navigation.navigate('Counter', { groupId });
  };

  // Show error if groupId is missing
  if (!groupId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#1e40af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ummah.groupDetail.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>
            Group ID not provided. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show error if there's an error and no group loaded
  if (error && !groupData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#1e40af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ummah.groupDetail.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchGroupDetails(groupId)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show loading if still loading OR if we don't have valid group data
  // Check if groupData exists and has required properties
  const hasValidGroupData = groupData && groupData.id && groupData.id === groupId && groupData.activity_type;
  const shouldShowLoading = isLoading || !hasValidGroupData;
  
  if (shouldShowLoading) {
    console.log('[GroupDetailScreen] Showing loading screen:', {
      isLoading,
      hasSelectedGroup: !!selectedGroup,
      isArray: Array.isArray(selectedGroup),
      selectedGroupRaw: selectedGroup,
      groupData,
      selectedGroupId: groupData?.id,
      currentGroupId: groupId,
      matches: groupData?.id === groupId,
      hasActivityType: !!groupData?.activity_type,
      hasValidGroupData,
    });
    
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#1e40af" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ummah.groupDetail.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>{t('ummah.loading')}</Text>
          {error && <Text style={styles.errorTextSmall}>{error}</Text>}
          {groupData && groupData.id !== groupId && (
            <Text style={styles.errorTextSmall}>
              Loading group {groupId}...
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {groupData?.title || 'Group Details'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Purpose Card - Dark Theme */}
        <View style={styles.purposeCard}>
          <Text style={styles.niyyahLabel}>{t('ummah.purpose')}</Text>
          <Text style={styles.purposeTitle}>{groupData?.purpose || ''}</Text>
          <Text style={styles.purposeSubtitle}>
            A communal prayer for strength and healing.
          </Text>
        </View>

        {/* Circular Progress Indicator */}
        {groupData?.target_count && (
          <View style={styles.progressContainer}>
            <CircularProgress
              current={totalCount}
              total={groupData.target_count}
              size={220}
              strokeWidth={14}
              color="#38bdf8"
              backgroundColor="#1e293b"
            />
          </View>
        )}

        {/* Contributors Section */}
        {groupCounters.length > 0 && (
          <View style={styles.contributorsSection}>
            <Text style={styles.contributorsTitle}>Contributors</Text>
            {groupCounters.map((counter) => {
              const member = groupMembers.find((m) => m.user_id === counter.user_id);
              const isCurrentUser = counter.user_id === user?.id;
              
              return (
                <View key={counter.id} style={styles.contributorCard}>
                  <View style={styles.contributorAvatar}>
                    <Text style={styles.contributorInitial}>
                      {counter.user?.nickname?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.contributorDetails}>
                    <Text style={styles.contributorName}>
                      {isCurrentUser ? 'You.' : counter.user?.nickname || 'Anonymous'}
                    </Text>
                    {member?.joined_at && (
                      <Text style={styles.contributorJoined}>
                        Joined {formatRelativeTime(member.joined_at)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.contributorRecitations}>
                    {counter.count.toLocaleString()} recitation{counter.count === 1 ? '' : 's'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Juz Grid (for Khatm) */}
        {groupData?.activity_type === 'khatm' && (
          <View style={styles.khatmSection}>
            <Text style={styles.khatmTitle}>
              {t('ummah.groupDetail.juzAssignments')}
            </Text>
            <View style={styles.juzGrid}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
                const assignment = juzAssignments.find(
                  (j) => j.juz_number === juzNum
                );
                const isMine = assignment?.taken_by_user === user?.id;
                const isTaken = !!assignment?.taken_by_user;

                return (
                  <TouchableOpacity
                    key={juzNum}
                    style={[
                      styles.juzButton,
                      isMine && styles.juzButtonMine,
                      isTaken && !isMine && styles.juzButtonTaken,
                    ]}
                    disabled={isTaken && !isMine}
                  >
                    <Text
                      style={[
                        styles.juzNumber,
                        isMine && styles.juzNumberMine,
                        isTaken && !isMine && styles.juzNumberTaken,
                      ]}
                    >
                      {juzNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.juzLegend}>
              <Text style={styles.juzLegendGray}>● Gray: </Text>
              {t('ummah.groupDetail.available')}{' '}
              <Text style={styles.juzLegendGreen}>● Green: </Text>
              {t('ummah.groupDetail.yours')}{' '}
              <Text style={styles.juzLegendOrange}>● Orange: </Text>
              {t('ummah.groupDetail.taken')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isJoining && styles.actionButtonDisabled,
          ]}
          onPress={isMember ? handleStartCounting : handleJoinGroup}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon
                name={isMember ? 'play-arrow' : 'person-add'}
                size={20}
                color="#fff"
                style={styles.actionIcon}
              />
              <Text style={styles.actionButtonText}>
                {isMember
                  ? 'Start Reading'
                  : 'Join & Start Reading'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Dark background like the image
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorTextSmall: {
    marginTop: 8,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 14,
    color: '#38bdf8',
    textTransform: 'capitalize',
  },
  purposeSection: {
    marginBottom: 16,
  },
  purposeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  purposeText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
  },
  dhikrSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  dhikrLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dhikrText: {
    fontSize: 18,
    color: '#1e40af',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 16,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 12,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  memberInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  memberName: {
    fontSize: 14,
    color: '#1e293b',
  },
  moreMembers: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },
  contributorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  contributorRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  contributorInfo: {
    flex: 1,
  },
  contributorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  contributorMessage: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  contributorCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
  },
  juzGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  juzButton: {
    width: '9%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  juzButtonMine: {
    backgroundColor: '#86efac',
  },
  juzButtonTaken: {
    backgroundColor: '#fed7aa',
  },
  juzNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  juzNumberMine: {
    color: '#166534',
  },
  juzNumberTaken: {
    color: '#9a3412',
  },
  juzLegend: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  juzLegendGray: {
    color: '#64748b',
  },
  juzLegendGreen: {
    color: '#166534',
  },
  juzLegendOrange: {
    color: '#9a3412',
  },
  footer: {
    padding: 16,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  // Dark theme styles for new design
  purposeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  niyyahLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  purposeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 28,
  },
  purposeSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  contributorsSection: {
    marginBottom: 16,
  },
  contributorsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  contributorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  contributorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contributorInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  contributorDetails: {
    flex: 1,
  },
  contributorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  contributorJoined: {
    fontSize: 12,
    color: '#94a3b8',
  },
  contributorRecitations: {
    fontSize: 14,
    fontWeight: '600',
    color: '#38bdf8',
    textAlign: 'right',
  },
  khatmSection: {
    marginBottom: 24,
    marginTop: 8,
  },
  khatmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  actionButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default GroupDetailScreen;

