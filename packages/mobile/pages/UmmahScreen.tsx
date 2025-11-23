// @ts-nocheck

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-icons';
import { RootStackParamList } from '../navigation/types';
import { useUmmahStore, ActivityType } from '../store/ummahStore';
import { useTranslation } from '../i18n';

type UmmahScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const ACTIVITY_TYPES: { type: ActivityType | 'all'; label: string; icon: string }[] = [
  { type: 'all', label: 'All', icon: 'apps' },
  { type: 'sholawat', label: 'Sholawat', icon: 'star' },
  { type: 'dua', label: 'Dua', icon: 'favorite' },
  { type: 'tasbih', label: 'Tasbih', icon: 'mood' },
  { type: 'khatm', label: 'Khatm', icon: 'menu-book' },
  { type: 'custom', label: 'Custom', icon: 'add-circle' },
];

const UmmahScreen: React.FC<UmmahScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  
  const [isMyGroupsExpanded, setIsMyGroupsExpanded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ActivityType | 'all'>('all');
  
  const {
    user,
    groups,
    myGroups,
    isLoading,
    initializeUser,
    fetchGroups,
    fetchMyGroups,
  } = useUmmahStore();

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        console.log('[UmmahScreen] Initializing user and fetching data...');
        await initializeUser();
        if (!mounted) return; // Component unmounted, don't continue
        
        const currentUser = useUmmahStore.getState().user;
        if (currentUser) {
          console.log('[UmmahScreen] User initialized:', currentUser.id);
          await fetchGroups();
          await fetchMyGroups();
        } else {
          const error = useUmmahStore.getState().error;
          console.error('[UmmahScreen] User initialization failed:', error);
        }
      } catch (error: any) {
        console.error('[UmmahScreen] Error initializing Ummah screen:', error);
        // Don't retry - show error to user
      }
    };
    init();
    
    return () => {
      mounted = false;
    };
  }, []); // Only run once

  const handleCreateGroup = () => {
    navigation.navigate('CreateGroup');
  };

  const handleViewGroup = (groupId: string) => {
    navigation.navigate('GroupDetail', { groupId });
  };

  // Filter groups by activity type
  const filteredGroups = useMemo(() => {
    if (selectedFilter === 'all') {
      return groups;
    }
    return groups.filter((group) => group.activity_type === selectedFilter);
  }, [groups, selectedFilter]);

  const filteredMyGroups = useMemo(() => {
    if (selectedFilter === 'all') {
      return myGroups;
    }
    return myGroups.filter((group) => group.activity_type === selectedFilter);
  }, [myGroups, selectedFilter]);

  const renderGroupCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleViewGroup(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.groupCardHeader}>
        <View style={styles.groupIconContainer}>
          <Icon
            name={
              item.activity_type === 'khatm' ? 'menu-book' :
              item.activity_type === 'dua' ? 'favorite' :
              item.activity_type === 'sholawat' ? 'star' :
              'mood'
            }
            size={24}
            color="#38bdf8"
          />
        </View>
        <View style={styles.groupCardBody}>
          <Text style={styles.groupTitle}>{item.title}</Text>
          <Text style={styles.groupPurpose} numberOfLines={2}>
            {item.purpose}
          </Text>
          {/* Creator info */}
          <View style={styles.creatorContainer}>
            <Icon name="person" size={14} color="#64748b" />
            <Text style={styles.creatorText}>
              {item.creator_nickname || 'Unknown'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.groupCardFooter}>
        <Text style={styles.groupActivity}>
          {item.activity_type.charAt(0).toUpperCase() + item.activity_type.slice(1)}
        </Text>
        {item.target_count ? (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {(item.total_count || 0).toLocaleString()} / {item.target_count.toLocaleString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.groupTarget}>
            {item.total_count ? `${item.total_count.toLocaleString()} recitations` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('ummah.title')}</Text>
        <Text style={styles.subtitle}>{t('ummah.subtitle')}</Text>
        
        {/* Niyyah Text */}
        <View style={styles.niyyahCard}>
          <Icon name="info-outline" size={16} color="#38bdf8" />
          <Text style={styles.niyyahText}>{t('ummah.niyyahInfo')}</Text>
        </View>
      </View>

      {isLoading && !user ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>{t('ummah.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCreateGroup}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonIcon}>
                <Icon name="add-circle" size={32} color="#ffffff" />
              </View>
              <Text style={styles.actionButtonText}>{t('ummah.createGroup')}</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            >
              {ACTIVITY_TYPES.map((activity) => (
                <TouchableOpacity
                  key={activity.type}
                  style={[
                    styles.filterButton,
                    selectedFilter === activity.type && styles.filterButtonActive,
                  ]}
                  onPress={() => setSelectedFilter(activity.type)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={activity.icon}
                    size={18}
                    color={selectedFilter === activity.type ? '#fff' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedFilter === activity.type && styles.filterButtonTextActive,
                    ]}
                  >
                    {activity.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* My Groups - Collapsible */}
          {filteredMyGroups.length > 0 && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setIsMyGroupsExpanded(!isMyGroupsExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionTitle}>{t('ummah.myGroups')}</Text>
                <Icon
                  name={isMyGroupsExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={24}
                  color="#94a3b8"
                />
              </TouchableOpacity>
              
              {isMyGroupsExpanded && (
                <FlatList
                  data={filteredMyGroups}
                  renderItem={renderGroupCard}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.groupsList}
                />
              )}
            </View>
          )}

          {/* All Groups */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('ummah.allGroups')}</Text>
            {filteredGroups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="group" size={64} color="#64748b" />
                <Text style={styles.emptyText}>
                  {selectedFilter === 'all' 
                    ? t('ummah.noGroups')
                    : t('ummah.noGroupsFilter', { filter: ACTIVITY_TYPES.find(a => a.type === selectedFilter)?.label || '' })}
                </Text>
                {selectedFilter !== 'all' && (
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => setSelectedFilter('all')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.clearFilterButtonText}>{t('ummah.clearFilter')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredGroups}
                renderItem={renderGroupCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
              />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  quickActions: {
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  niyyahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  niyyahText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  filterContainer: {
    marginBottom: 24,
  },
  filterList: {
    gap: 8,
    paddingRight: 24,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterButtonActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  groupsList: {
    paddingRight: 24,
  },
  groupCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    padding: 16,
    marginRight: 8,
    width: 280,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardSeparator: {
    height: 8,
  },
  groupCardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCardBody: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  groupPurpose: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 8,
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  creatorText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  groupCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  groupActivity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
    textTransform: 'capitalize',
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  groupTarget: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearFilterButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  clearFilterButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UmmahScreen;

