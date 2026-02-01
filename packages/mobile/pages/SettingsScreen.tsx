// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-icons';

import { SUPPORTED_LANGUAGES, useLanguage, useTranslation } from '../i18n';
import type { LanguageCode, TranslationKey } from '../i18n/translations';
import { openSettings } from 'react-native-permissions';
import {
  ensureNotificationPermission,
  ensureExactAlarmPermission,
  schedulePrayerNotificationsRange,
  cancelPrayerNotifications,
  PRAYER_NOTIFICATION_NAMES,
  normalizeNotificationConfig,
  generatePrayerSchedules,
  scheduleTahajjudNotification,
  cancelTahajjudNotification,
} from '../notifications/notificationService';
import { locationStorage } from '../storage/locationStorage';
import { settingsStorage } from '../storage/settingsStorage';

const clampMinutes = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 180) {
    return 180;
  }
  return rounded;
};

const formatTo12Hour = (time: string): string => {
  const [hourString, minuteString] = time.split(':');
  const hours = Number.parseInt(hourString, 10);
  const minutes = Number.parseInt(minuteString, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHour = hours % 12 || 12;
  return `${String(normalizedHour)}:${minuteString.padStart(2, '0')} ${period}`;
};

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const initialNotificationConfig = useMemo(
    () => settingsStorage.getNotificationConfig(),
    [],
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () => settingsStorage.getNotificationsEnabled(),
  );
  const [twentyFourHourClock, setTwentyFourHourClock] = useState<boolean>(
    () => settingsStorage.getTwentyFourHourPreference(),
  );
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [schedulingNotifications, setSchedulingNotifications] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState(initialNotificationConfig);
  const [beforeMinutesInput, setBeforeMinutesInput] = useState(
    String(initialNotificationConfig.minutesBefore),
  );
  const [afterMinutesInput, setAfterMinutesInput] = useState(
    String(initialNotificationConfig.minutesAfter),
  );
  const [tahajjudEnabled, setTahajjudEnabled] = useState<boolean>(() => settingsStorage.getTahajjudReminderEnabled());
  const [tahajjudTime, setTahajjudTime] = useState<string | null>(() => settingsStorage.getTahajjudReminderTime());
  const [tahajjudMethod, setTahajjudMethod] = useState<'custom' | 'lastThird' | 'middle'>(() => settingsStorage.getTahajjudReminderMethod());
  const [tahajjudLeadMinutes, setTahajjudLeadMinutes] = useState<number>(() => settingsStorage.getTahajjudReminderLeadMinutes());
  const [calculationMethod, setCalculationMethod] = useState<string>(() => settingsStorage.getCalculationMethod() || 'Diyanet');
  const [calculationMethodMenuOpen, setCalculationMethodMenuOpen] = useState(false);

  const translatePrayerName = useCallback(
    (name: string) => {
      const key = `prayer.name.${name.toLowerCase()}` as TranslationKey;
      const translated = t(key);
      return translated === key ? name : translated;
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      setTahajjudEnabled(settingsStorage.getTahajjudReminderEnabled());
      setTahajjudTime(settingsStorage.getTahajjudReminderTime());
      setTahajjudMethod(settingsStorage.getTahajjudReminderMethod());
      setTahajjudLeadMinutes(settingsStorage.getTahajjudReminderLeadMinutes());
    }, []),
  );

  const languageOptions = useMemo(() => SUPPORTED_LANGUAGES, []);

  const calculationMethodOptions = useMemo(() => [
    { key: 'Diyanet', label: 'Diyanet (Turkey)' },
    { key: 'MuslimWorldLeague', label: 'Muslim World League' },
    { key: 'Karachi', label: 'Karachi' },
    { key: 'Egyptian', label: 'Egyptian' },
    { key: 'UmmAlQura', label: 'Umm al-Qura' },
  ], []);

  useEffect(() => {
    setBeforeMinutesInput(String(notificationConfig.minutesBefore));
  }, [notificationConfig.minutesBefore]);

  useEffect(() => {
    setAfterMinutesInput(String(notificationConfig.minutesAfter));
  }, [notificationConfig.minutesAfter]);

  const schedulePrayerNotifications = useCallback(
    async (configOverride, options?: { force?: boolean }) => {
      const effectiveConfig = configOverride ?? notificationConfig;
      const storedLocation = await locationStorage.get();
      if (!storedLocation) {
        Alert.alert(
          t('settings.location.title'),
          t('settings.location.subtitle'),
        );
        return false;
      }

      setSchedulingNotifications(true);
      try {
        const schedules = generatePrayerSchedules({
          location: storedLocation,
          startDate: new Date(),
          days: 30,
          method: 'Karachi',
        });

        if (!schedules.length) {
          await cancelPrayerNotifications();
          return true;
        }

        const contextKey = `${language}-${storedLocation.latitude}-${storedLocation.longitude}-${storedLocation.timezone}`;
        const success = await schedulePrayerNotificationsRange({
          days: schedules,
          translator: t,
          translatePrayerName,
          contextKey,
          config: effectiveConfig,
          force: options?.force ?? false,
        });

        return success;
      } catch (error) {
        console.error('Failed to schedule prayer notifications.', error);
        return false;
      } finally {
        setSchedulingNotifications(false);
      }
    },
    [notificationConfig, language, t, translatePrayerName],
  );

  useEffect(() => {
    if (!notificationsEnabled) {
      return;
    }

    schedulePrayerNotifications(undefined, { force: false }).catch((error) => {
      console.error('Failed to refresh prayer notifications.', error);
    });
  }, [notificationsEnabled, schedulePrayerNotifications]);

  const updateNotificationConfig = useCallback(
    (updater) => {
      setNotificationConfig((prevConfig) => {
        const draft =
          typeof updater === 'function' ? updater(prevConfig) : updater;
        const normalized = normalizeNotificationConfig(draft);
        settingsStorage.setNotificationConfig(normalized);

        if (notificationsEnabled) {
          schedulePrayerNotifications(normalized, { force: true }).catch((error) => {
            console.error('Failed to reschedule prayer notifications.', error);
          });
        }

        return normalized;
      });
    },
    [notificationsEnabled, schedulePrayerNotifications],
  );

  const handleToggleAtTime = useCallback(
    (value: boolean) => {
      updateNotificationConfig((prev) => ({
        ...prev,
        sendAtPrayerTime: value,
      }));
    },
    [updateNotificationConfig],
  );

  const handleToggleBefore = useCallback(
    (value: boolean) => {
      updateNotificationConfig((prev) => {
        const next = {
          ...prev,
          sendBefore: value,
        };
        if (value && prev.minutesBefore === 0) {
          next.minutesBefore = Math.max(prev.minutesBefore || 5, 1);
        }
        return next;
      });
    },
    [updateNotificationConfig],
  );

  const handleToggleAfter = useCallback(
    (value: boolean) => {
      updateNotificationConfig((prev) => {
        const next = {
          ...prev,
          sendAfter: value,
        };
        if (value && prev.minutesAfter === 0) {
          next.minutesAfter = Math.max(prev.minutesAfter || 5, 1);
        }
        return next;
      });
    },
    [updateNotificationConfig],
  );

  const handlePrayerToggle = useCallback(
    (name: string, value: boolean) => {
      updateNotificationConfig((prev) => ({
        ...prev,
        enabledPrayers: {
          ...prev.enabledPrayers,
          [name]: value,
        },
      }));
    },
    [updateNotificationConfig],
  );

  const handleBeforeMinutesChange = useCallback((text: string) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    setBeforeMinutesInput(sanitized);
  }, []);

  const commitBeforeMinutes = useCallback(() => {
    const trimmed = beforeMinutesInput.trim();
    if (trimmed.length === 0) {
      setBeforeMinutesInput(String(notificationConfig.minutesBefore));
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setBeforeMinutesInput(String(notificationConfig.minutesBefore));
      return;
    }

    const clamped = clampMinutes(parsed);
    if (clamped === notificationConfig.minutesBefore) {
      setBeforeMinutesInput(String(clamped));
      return;
    }

    updateNotificationConfig((prev) => ({
      ...prev,
      minutesBefore: clamped,
    }));
    setBeforeMinutesInput(String(clamped));
  }, [beforeMinutesInput, notificationConfig.minutesBefore, updateNotificationConfig]);

  const handleAfterMinutesChange = useCallback((text: string) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    setAfterMinutesInput(sanitized);
  }, []);

  const commitAfterMinutes = useCallback(() => {
    const trimmed = afterMinutesInput.trim();
    if (trimmed.length === 0) {
      setAfterMinutesInput(String(notificationConfig.minutesAfter));
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setAfterMinutesInput(String(notificationConfig.minutesAfter));
      return;
    }

    const clamped = clampMinutes(parsed);
    if (clamped === notificationConfig.minutesAfter) {
      setAfterMinutesInput(String(clamped));
      return;
    }

    updateNotificationConfig((prev) => ({
      ...prev,
      minutesAfter: clamped,
    }));
    setAfterMinutesInput(String(clamped));
  }, [afterMinutesInput, notificationConfig.minutesAfter, updateNotificationConfig]);

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

  const handleCalculationMethodChange = useCallback(
    (method: string) => {
      if (method === calculationMethod) {
        setCalculationMethodMenuOpen(false);
        return;
      }

      setCalculationMethod(method);
      settingsStorage.setCalculationMethod(method);
      setCalculationMethodMenuOpen(false);
    },
    [calculationMethod],
  );

  const formatTahajjudTime = useCallback(
    (time: string | null) => {
      if (!time) {
        return t('settings.notifications.tahajjud.timeUnset');
      }
      if (twentyFourHourClock) {
        return time;
      }
      return formatTo12Hour(time);
    },
    [t, twentyFourHourClock],
  );

  const formatLeadLabel = useCallback(
    (minutes: number) => {
      if (!minutes) {
        return t('tahajjud.remindAtTime');
      }
      return t('tahajjud.remindMinutes', { minutes });
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

          const exactGranted = await ensureExactAlarmPermission();
          if (!exactGranted) {
            Alert.alert(
              t('notifications.exactAlarmPermissionTitle'),
              t('notifications.exactAlarmPermissionMessage'),
              [
                { text: t('common.deny'), style: 'cancel' },
                {
                  text: t('notifications.openSettings'),
                  onPress: () => {
                    openSettings().catch((error) => {
                      console.error('Failed to open settings for exact alarm permission.', error);
                    });
                  },
                },
              ],
              { cancelable: true },
            );
            setNotificationsEnabled(false);
            settingsStorage.setNotificationsEnabled(false);
            return;
          }

          const scheduled = await schedulePrayerNotifications(notificationConfig, { force: true });
          if (!scheduled) {
            setNotificationsEnabled(false);
            settingsStorage.setNotificationsEnabled(false);
            return;
          }

          setNotificationsEnabled(true);
          settingsStorage.setNotificationsEnabled(true);

          if (tahajjudEnabled && tahajjudTime) {
            const leadMinutes = settingsStorage.getTahajjudReminderLeadMinutes();
            setTahajjudLeadMinutes(leadMinutes);
            const tahajjudScheduled = await scheduleTahajjudNotification({
              translator: t,
              time: tahajjudTime,
              leadMinutes,
            });
            if (!tahajjudScheduled) {
              console.warn('Failed to schedule tahajjud reminder after enabling notifications.');
            }
          }

        } else {
          setNotificationsEnabled(false);
          settingsStorage.setNotificationsEnabled(false);
          await cancelPrayerNotifications();
          await cancelTahajjudNotification();
          setSchedulingNotifications(false);
        }
      } catch (error) {
        console.error('Failed to update notification preference.', error);
      } finally {
        setUpdatingNotifications(false);
      }
    },
    [t, notificationConfig, schedulePrayerNotifications, tahajjudEnabled, tahajjudTime],
  );

  const handleTahajjudToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const nextTime = settingsStorage.getTahajjudReminderTime();
        setTahajjudTime(nextTime);
        if (!nextTime) {
          navigation.navigate('TahajjudSettings');
          setTahajjudEnabled(false);
          settingsStorage.setTahajjudReminderEnabled(false);
          return;
        }

        if (!notificationsEnabled) {
          Alert.alert(
            t('settings.notifications.tahajjud.title'),
            t('tahajjud.notificationsDisabled'),
          );
          setTahajjudEnabled(false);
          settingsStorage.setTahajjudReminderEnabled(false);
          return;
        }

        setUpdatingNotifications(true);
        try {
          const leadMinutes = settingsStorage.getTahajjudReminderLeadMinutes();
          setTahajjudLeadMinutes(leadMinutes);
          const scheduled = await scheduleTahajjudNotification({
            translator: t,
            time: nextTime,
            leadMinutes,
          });
          if (!scheduled) {
            throw new Error('tahajjud scheduling failed');
          }
          setTahajjudEnabled(true);
          setTahajjudMethod(settingsStorage.getTahajjudReminderMethod());
          settingsStorage.setTahajjudReminderEnabled(true);
        } catch (error) {
          console.error('Failed to enable tahajjud reminder.', error);
          Alert.alert(
            t('settings.notifications.tahajjud.title'),
            t('tahajjud.scheduleFailed'),
          );
          setTahajjudEnabled(false);
          settingsStorage.setTahajjudReminderEnabled(false);
          await cancelTahajjudNotification();
        } finally {
          setUpdatingNotifications(false);
        }
        return;
      }

      setUpdatingNotifications(true);
      try {
        setTahajjudEnabled(false);
        settingsStorage.setTahajjudReminderEnabled(false);
        await cancelTahajjudNotification();
      } catch (error) {
        console.error('Failed to disable tahajjud reminder.', error);
      } finally {
        setUpdatingNotifications(false);
      }
    },
    [notificationsEnabled, t, navigation],
  );

  const handleTwentyFourHourToggle = useCallback((value: boolean) => {
    setTwentyFourHourClock(value);
    settingsStorage.setTwentyFourHourPreference(value);
  }, []);

  const handleOpenTahajjudSettings = useCallback(() => {
    navigation.navigate('TahajjudSettings');
  }, [navigation]);

  const notificationControlsDisabled =
    !notificationsEnabled || schedulingNotifications || updatingNotifications;
  const tahajjudControlsDisabled = schedulingNotifications || updatingNotifications;

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
          disabled={updatingNotifications || schedulingNotifications}
          trackColor={{ false: '#1f2937', true: '#3b82f6' }}
          thumbColor={notificationsEnabled ? '#93c5fd' : '#e5e7eb'}
        />
      </View>

      <View
        pointerEvents={notificationControlsDisabled ? 'none' : 'auto'}
        style={[
          styles.notificationSettingsCard,
          (!notificationsEnabled || schedulingNotifications) && styles.notificationSettingsCardDisabled,
        ]}
      >
        {schedulingNotifications ? (
          <View style={styles.notificationLoading}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={styles.notificationLoadingText}>{t('settings.notifications.scheduling')}</Text>
          </View>
        ) : null}
        <View style={styles.notificationRow}>
          <View style={styles.notificationRowText}>
            <Text style={styles.rowTitle}>{t('settings.notifications.atTime.title')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.notifications.atTime.subtitle')}</Text>
          </View>
          <Switch
            value={notificationConfig.sendAtPrayerTime}
            onValueChange={handleToggleAtTime}
            trackColor={{ false: '#1f2937', true: '#3b82f6' }}
            thumbColor={notificationConfig.sendAtPrayerTime ? '#93c5fd' : '#e5e7eb'}
            disabled={notificationControlsDisabled}
          />
        </View>

        <View style={styles.notificationRow}>
          <View style={styles.notificationRowText}>
            <Text style={styles.rowTitle}>{t('settings.notifications.before.title')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.notifications.before.subtitle')}</Text>
          </View>
          <Switch
            value={notificationConfig.sendBefore}
            onValueChange={handleToggleBefore}
            trackColor={{ false: '#1f2937', true: '#3b82f6' }}
            thumbColor={notificationConfig.sendBefore ? '#93c5fd' : '#e5e7eb'}
            disabled={notificationControlsDisabled}
          />
        </View>
        {notificationConfig.sendBefore ? (
          <View style={styles.offsetInputRow}>
            <Text style={styles.offsetInputLabel}>{t('settings.notifications.before.inputLabel')}</Text>
            <TextInput
              style={styles.offsetInput}
              value={beforeMinutesInput}
              onChangeText={handleBeforeMinutesChange}
              onEndEditing={commitBeforeMinutes}
              onSubmitEditing={commitBeforeMinutes}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
              placeholder="0"
              placeholderTextColor="#475569"
              editable={!notificationControlsDisabled}
            />
          </View>
        ) : null}

        <View style={styles.notificationRow}>
          <View style={styles.notificationRowText}>
            <Text style={styles.rowTitle}>{t('settings.notifications.after.title')}</Text>
            <Text style={styles.rowSubtitle}>{t('settings.notifications.after.subtitle')}</Text>
          </View>
          <Switch
            value={notificationConfig.sendAfter}
            onValueChange={handleToggleAfter}
            trackColor={{ false: '#1f2937', true: '#3b82f6' }}
            thumbColor={notificationConfig.sendAfter ? '#93c5fd' : '#e5e7eb'}
            disabled={notificationControlsDisabled}
          />
        </View>
        {notificationConfig.sendAfter ? (
          <View style={styles.offsetInputRow}>
            <Text style={styles.offsetInputLabel}>{t('settings.notifications.after.inputLabel')}</Text>
            <TextInput
              style={styles.offsetInput}
              value={afterMinutesInput}
              onChangeText={handleAfterMinutesChange}
              onEndEditing={commitAfterMinutes}
              onSubmitEditing={commitAfterMinutes}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
              placeholder="0"
              placeholderTextColor="#475569"
              editable={!notificationControlsDisabled}
            />
          </View>
        ) : null}

        <Text style={styles.notificationCardHeader}>
          {t('settings.notifications.prayerSelection.title')}
        </Text>
        <Text style={styles.notificationCardDescription}>
          {t('settings.notifications.prayerSelection.subtitle')}
        </Text>

        {PRAYER_NOTIFICATION_NAMES.map((name, index) => (
          <View
            key={name}
            style={[
              styles.prayerToggleRow,
              index === PRAYER_NOTIFICATION_NAMES.length - 1 && styles.prayerToggleRowLast,
            ]}
          >
            <Text style={styles.prayerToggleLabel}>{translatePrayerName(name)}</Text>
            <Switch
              value={Boolean(notificationConfig.enabledPrayers[name])}
              onValueChange={(value) => handlePrayerToggle(name, value)}
              trackColor={{ false: '#1f2937', true: '#3b82f6' }}
              thumbColor={notificationConfig.enabledPrayers[name] ? '#93c5fd' : '#e5e7eb'}
              disabled={notificationControlsDisabled}
            />
          </View>
        ))}
        <View
          pointerEvents={tahajjudControlsDisabled ? 'none' : 'auto'}
          style={[
            styles.tahajjudSettingsCard,
            (!notificationsEnabled || tahajjudControlsDisabled) && styles.tahajjudSettingsCardDisabled,
          ]}
        >
          <View style={styles.tahajjudHeaderRow}>
            <View style={styles.tahajjudHeaderText}>
              <Text style={styles.rowTitle}>{t('settings.notifications.tahajjud.title')}</Text>
              <Text style={styles.rowSubtitle}>{t('settings.notifications.tahajjud.subtitle')}</Text>
            </View>
            <Switch
              value={tahajjudEnabled}
              onValueChange={handleTahajjudToggle}
              trackColor={{ false: '#1f2937', true: '#2563eb' }}
              thumbColor={tahajjudEnabled ? '#93c5fd' : '#e5e7eb'}
              disabled={tahajjudControlsDisabled}
            />
          </View>
          <View style={styles.tahajjudSummaryRow}>
            <View style={styles.tahajjudSummaryText}>
              <Text style={styles.tahajjudSummaryTitle}>{t('tahajjud.methodLabel', { method: t(`tahajjud.method.${tahajjudMethod}`) })}</Text>
              <Text style={styles.tahajjudSummaryLine}>
                {tahajjudTime
                  ? t('tahajjud.summaryTime', { time: formatTahajjudTime(tahajjudTime) })
                  : t('settings.notifications.tahajjud.timeUnset')}
              </Text>
              <Text style={styles.tahajjudSummaryLine}>
                {formatLeadLabel(tahajjudLeadMinutes)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.tahajjudManageButton}
              activeOpacity={0.85}
              onPress={handleOpenTahajjudSettings}
              disabled={tahajjudControlsDisabled}
            >
              <Text style={styles.tahajjudManageText}>{t('tahajjud.manageAction')}</Text>
              <Icon name="chevron-right" size={18} color="#60a5fa" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {renderSectionHeader(t('settings.section.prayerTime'))}
      <View style={styles.languageCard}>
        <Text style={styles.rowTitle}>Calculation Method</Text>
        <Text style={styles.rowSubtitle}>Choose how prayer times are calculated</Text>
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={styles.dropdownControl}
            activeOpacity={0.8}
            onPress={() => setCalculationMethodMenuOpen((prev) => !prev)}
          >
            <Text style={styles.dropdownValue}>
              {calculationMethodOptions.find(option => option.key === calculationMethod)?.label || calculationMethod}
            </Text>
            <Icon
              name={calculationMethodMenuOpen ? 'expand-less' : 'expand-more'}
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
          {calculationMethodMenuOpen && (
            <View style={styles.dropdownMenu}>
              {calculationMethodOptions.map((option) => {
                const isActive = option.key === calculationMethod;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    activeOpacity={0.8}
                    onPress={() => handleCalculationMethodChange(option.key)}
                  >
                    <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        <Text style={styles.rowSubtitle}>Changes take effect when you return to the prayer times screen.</Text>
      </View>

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
  notificationSettingsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 16,
  },
  notificationSettingsCardDisabled: {
    opacity: 0.85,
  },
  notificationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 12, 24, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    marginBottom: 16,
  },
  notificationLoadingText: {
    marginLeft: 12,
    color: '#cbd5f5',
    fontSize: 13,
    fontWeight: '500',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notificationRowText: {
    flex: 1,
    marginRight: 12,
  },
  offsetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 26, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  offsetInputLabel: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  offsetInput: {
    width: 72,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  notificationCardHeader: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  notificationCardDescription: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  tahajjudSettingsCard: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(12, 18, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  tahajjudSettingsCardDisabled: {
    opacity: 0.85,
  },
  tahajjudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tahajjudHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  tahajjudSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 16,
  },
  tahajjudSummaryText: {
    flex: 1,
  },
  tahajjudSummaryTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  tahajjudSummaryLine: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  tahajjudManageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  tahajjudManageText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  prayerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  prayerToggleRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  prayerToggleLabel: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '500',
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
