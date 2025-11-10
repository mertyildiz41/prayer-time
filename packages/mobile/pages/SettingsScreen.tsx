// @ts-nocheck

import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { PrayerTimeCalculator } from '@prayer-time/shared';
import Icon from '@react-native-vector-icons/material-icons';

import { SUPPORTED_LANGUAGES, useLanguage, useTranslation } from '../i18n';
import type { LanguageCode, TranslationKey } from '../i18n/translations';
import { ensureNotificationPermission, scheduleDailyPrayerNotifications, cancelPrayerNotifications } from '../notifications/notificationService';
import { locationStorage } from '../storage/locationStorage';
import { settingsStorage } from '../storage/settingsStorage';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () => settingsStorage.getNotificationsEnabled(),
  );
  const [twentyFourHourClock, setTwentyFourHourClock] = useState<boolean>(
    () => settingsStorage.getTwentyFourHourPreference(),
  );
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const languageOptions = useMemo(() => SUPPORTED_LANGUAGES, []);

  const handleChangeLocation = () => {
    navigation.dispatch(StackActions.replace('LocationSearch'));
  };

  const handleLanguageChange = useCallback(
    (code: LanguageCode) => {
      if (code === language) {
        setLanguageMenuOpen(false);
        return;
      }

      setLanguage(code);
      setLanguageMenuOpen(false);
    },
    [language, setLanguage],
  );

  const translatePrayerName = useCallback(
    (name: string) => {
      const key = `prayer.name.${name.toLowerCase()}` as TranslationKey;
      const translated = t(key);
      return translated === key ? name : translated;
    },
    [t],
  );

  const handleNotificationsToggle = useCallback(
    async (value: boolean) => {
      setUpdatingNotifications(true);
      try {
        if (value) {
          const granted = await ensureNotificationPermission();
          if (!granted) {
            Alert.alert(
              t('notifications.permissionDeniedTitle'),
              t('notifications.permissionDeniedMessage'),
            );
            setNotificationsEnabled(false);
            settingsStorage.setNotificationsEnabled(false);
            return;
          }

          setNotificationsEnabled(true);
          settingsStorage.setNotificationsEnabled(true);

          const storedLocation = locationStorage.get();
          if (storedLocation) {
            const times = PrayerTimeCalculator.calculatePrayerTimes(
              new Date(),
              storedLocation,
              'Karachi',
            );
            await scheduleDailyPrayerNotifications({
              prayers: times.prayers,
              dateKey: `${times.date}-${language}-${storedLocation.latitude}-${storedLocation.longitude}`,
              translator: t,
              translatePrayerName,
              force: true,
            });
          } else {
            Alert.alert(
              t('settings.location.title'),
              t('settings.location.subtitle'),
            );
          }
        } else {
          setNotificationsEnabled(false);
          settingsStorage.setNotificationsEnabled(false);
          await cancelPrayerNotifications();
        }
      } catch (error) {
        console.error('Failed to update notification preference.', error);
      } finally {
        setUpdatingNotifications(false);
      }
    },
    [t, translatePrayerName],
  );

  const handleTwentyFourHourToggle = useCallback((value: boolean) => {
    setTwentyFourHourClock(value);
    settingsStorage.setTwentyFourHourPreference(value);
  }, []);

  const renderSectionHeader = (label: string) => (
    <Text style={styles.sectionHeader}>{label}</Text>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('settings.title')}</Text>
      <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>

      {renderSectionHeader(t('settings.section.notifications'))}
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t('settings.notifications.dailyReminders.title')}</Text>
          <Text style={styles.rowSubtitle}>{t('settings.notifications.dailyReminders.subtitle')}</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleNotificationsToggle}
          disabled={updatingNotifications}
          trackColor={{ false: '#1f2937', true: '#3b82f6' }}
          thumbColor={notificationsEnabled ? '#93c5fd' : '#e5e7eb'}
        />
      </View>

      {renderSectionHeader(t('settings.section.prayerTime'))}
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t('settings.prayerTime.twentyFourHour.title')}</Text>
          <Text style={styles.rowSubtitle}>{t('settings.prayerTime.twentyFourHour.subtitle')}</Text>
        </View>
        <Switch
          value={twentyFourHourClock}
          onValueChange={handleTwentyFourHourToggle}
          trackColor={{ false: '#1f2937', true: '#3b82f6' }}
          thumbColor={twentyFourHourClock ? '#93c5fd' : '#e5e7eb'}
        />
      </View>

      {renderSectionHeader(t('settings.section.language'))}
      <View style={styles.languageCard}>
        <Text style={styles.rowTitle}>{t('settings.language.title')}</Text>
        <Text style={styles.rowSubtitle}>{t('settings.language.subtitle')}</Text>
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={styles.dropdownControl}
            activeOpacity={0.8}
            onPress={() => setLanguageMenuOpen((prev) => !prev)}
          >
            <Text style={styles.dropdownValue}>{t(`language.label.${language}`)}</Text>
            <Icon
              name={languageMenuOpen ? 'expand-less' : 'expand-more'}
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
          {languageMenuOpen && (
            <View style={styles.dropdownMenu}>
              {languageOptions.map((code) => {
                const isActive = code === language;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    activeOpacity={0.8}
                    onPress={() => handleLanguageChange(code)}
                  >
                    <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                      {t(`language.label.${code}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.actionCard} onPress={handleChangeLocation}>
        <Text style={styles.actionTitle}>{t('settings.location.title')}</Text>
        <Text style={styles.actionSubtitle}>{t('settings.location.subtitle')}</Text>
        <Text style={styles.actionLink}>{t('settings.location.action')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
        <Text style={styles.actionTitle}>{t('settings.feedback.title')}</Text>
        <Text style={styles.actionSubtitle}>{t('settings.feedback.subtitle')}</Text>
        <Text style={styles.actionLink}>{t('settings.feedback.action')}</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>{t('settings.version')}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  content: {
    paddingTop: 48,
    paddingBottom: 120,
    paddingHorizontal: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionHeader: {
    color: '#64748b',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  actionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 20,
  },
  actionTitle: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  actionSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 12,
  },
  actionLink: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 14,
  },
  languageCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  dropdownWrapper: {
    marginTop: 12,
  },
  dropdownControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(10, 14, 26, 0.5)',
  },
  dropdownValue: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownMenu: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  dropdownItemText: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  versionText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default SettingsScreen;
