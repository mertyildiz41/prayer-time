// @ts-nocheck
/// <reference types="react-native" />

import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import { Location } from '@prayer-time/shared';

import { useTranslation } from '../i18n';

type IconName = 'home' | 'explore' | 'menu-book' | 'settings';

type BottomNavBarProps = {
  location?: Location;
  currentRoute?: string;
  onNavigate?: (target: string) => void;
};

type NavItem = {
  key: 'home' | 'qibla' | 'quran' | 'settings';
  labelKey: 'navigation.home' | 'navigation.qibla' | 'navigation.quran' | 'navigation.settings';
  icon: IconName;
  target?: string;
  requiresLocation?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'navigation.home', icon: 'home', target: 'PrayerTime', requiresLocation: true },
  { key: 'qibla', labelKey: 'navigation.qibla', icon: 'explore', target: 'Qibla', requiresLocation: true },
  { key: 'quran', labelKey: 'navigation.quran', icon: 'menu-book', target: 'Quran' },
  { key: 'settings', labelKey: 'navigation.settings', icon: 'settings', target: 'Settings' },
];

export const BottomNavBar = ({ location, currentRoute, onNavigate }: BottomNavBarProps) => {
  const { t } = useTranslation();

  const handlePress = useCallback(
    (item: NavItem) => {
      if (!item.target || !onNavigate) {
        return;
      }

      if (item.requiresLocation && !location) {
        return;
      }

      if (currentRoute === item.target) {
        return;
      }

      onNavigate(item.target);
    },
    [currentRoute, location, onNavigate],
  );

  return (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.target ? currentRoute === item.target : false;
        const isDisabled = !item.target || (item.requiresLocation && !location) || !onNavigate;

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => handlePress(item)}
            disabled={isDisabled}
          >
            <Icon name={item.icon} size={20}
              color={isActive ? '#38bdf8' : '#94a3b8'}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  hijriText: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  largeCard: {
    backgroundColor: 'rgba(23, 58, 93, 0.8)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  largeCardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7dd3fc',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  largeCardTime: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  countdownSection: {
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7dd3fc',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  countdownTime: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  prayersContainer: {
    backgroundColor: 'rgba(10, 14, 26, 0.5)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  prayerRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  prayerRowActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    paddingLeft: 17,
  },
  prayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  prayerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94a3b8',
  },
  prayerNameActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  prayerTime: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94a3b8',
  },
  prayerTimeActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  bottomNav: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 14, 26, 0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 12,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  navLabelActive: {
    color: '#38bdf8',
  },
  errorText: {
    fontSize: 16,
    color: '#f8fafc',
    textAlign: 'center',
  },
});

