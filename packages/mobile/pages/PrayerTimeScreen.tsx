// @ts-nocheck

import React, { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-icons';
import { DailyPrayerTimes, Location, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';

import { useLanguage, useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import {
  schedulePrayerNotificationsRange,
  generatePrayerSchedules,
  buildNotificationConfigKey,
  scheduleTahajjudNotification,
  cancelTahajjudNotification,
} from '../notifications/notificationService';
import { settingsStorage } from '../storage/settingsStorage';

type MaterialIconName = ComponentProps<typeof Icon>['name'];

type PrayerTimeScreenProps = {
  location: Location;
};

const formatCountdown = (ms: number): string => {
  const isNegative = ms < 0;
  const absoluteMs = isNegative ? -ms : ms;

  const totalSeconds = Math.floor(absoluteMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return isNegative ? `-${formatted}` : formatted;
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

const PRAYER_ICONS: Partial<Record<PrayerTime['name'], MaterialIconName>> = {
  Fajr: 'wb-twilight',
  Dhuhr: 'wb-sunny',
  Asr: 'access-time',
  Maghrib: 'wb-twilight',
  Isha: 'nightlight',
};

function PrayerTimeScreen({ location }: PrayerTimeScreenProps) {
  const navigation = useNavigation();
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () => settingsStorage.getNotificationsEnabled(),
  );
  const [notificationConfigVersion, setNotificationConfigVersion] = useState(0);
  const lastScheduleKeyRef = useRef<string | null>(null);
  const [tahajjudEnabled, setTahajjudEnabled] = useState<boolean>(() => settingsStorage.getTahajjudReminderEnabled());
  const [tahajjudTime, setTahajjudTime] = useState<string | null>(() => settingsStorage.getTahajjudReminderTime());
  const [tahajjudLeadMinutes, setTahajjudLeadMinutes] = useState<number>(() => settingsStorage.getTahajjudReminderLeadMinutes());
  const [twentyFourHourClock, setTwentyFourHourClock] = useState<boolean>(() => settingsStorage.getTwentyFourHourPreference());

  const translatePrayerName = useCallback(
    (name: PrayerTime['name']) => {
      const key = `prayer.name.${name.toLowerCase()}` as TranslationKey;
      const translated = t(key);
      return translated === key ? name : translated;
    },
    [t],
  );

  const formatTahajjudTime = useCallback(
    (time: string | null) => {
      if (!time) {
        return t('prayer.tahajjud.timeUnset');
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

  useFocusEffect(
    useCallback(() => {
      setNotificationsEnabled(settingsStorage.getNotificationsEnabled());
      setNotificationConfigVersion((prev) => prev + 1);
      setTahajjudEnabled(settingsStorage.getTahajjudReminderEnabled());
      setTahajjudTime(settingsStorage.getTahajjudReminderTime());
      setTahajjudLeadMinutes(settingsStorage.getTahajjudReminderLeadMinutes());
      setTwentyFourHourClock(settingsStorage.getTwentyFourHourPreference());
      lastScheduleKeyRef.current = null;
    }, []),
  );

  const loadPrayerTimes = useCallback(async () => {
    try {
      setLoading(true);
      const times = PrayerTimeCalculator.calculatePrayerTimes(
        new Date(),
        location,
        'Karachi', // TODO: allow user to choose a calculation method
      );
      setPrayerTimes(times);
      setNextPrayer(PrayerTimeCalculator.getNextPrayerTime(times.prayers));
      setErrorKey(null);
    } catch (err) {
      console.error(err);
      setErrorKey('prayer.error.load');
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    void loadPrayerTimes();
  }, [loadPrayerTimes]);

  useEffect(() => {
    if (!prayerTimes) {
      setNextPrayer(null);
      setCountdown('00:00:00');
      return;
    }

    const updateNextPrayer = () => {
      const upcoming = PrayerTimeCalculator.getNextPrayerTime(prayerTimes.prayers);
      setNextPrayer(upcoming);

      if (upcoming) {
        const remaining = PrayerTimeCalculator.getTimeUntilPrayer(upcoming);
        setCountdown(formatCountdown(remaining));
      } else {
        setCountdown('00:00:00');
      }
    };

    updateNextPrayer();
    const interval = setInterval(updateNextPrayer, 1000);

    return () => clearInterval(interval);
  }, [prayerTimes]);

  useEffect(() => {
    if (!prayerTimes || !notificationsEnabled) {
      return;
    }

    const config = settingsStorage.getNotificationConfig();
    const schedules = generatePrayerSchedules({
      location,
      startDate: new Date(),
      days: 30,
      method: 'Karachi',
    });

    if (!schedules.length) {
      return;
    }

    const contextKey = `${language}-${location.latitude}-${location.longitude}-${location.timezone}`;
    const configSignature = buildNotificationConfigKey(config);
    const firstDate = schedules[0]?.date ?? prayerTimes.date;
    const scheduleKey = `${contextKey}|${configSignature}|${firstDate}`;

    if (lastScheduleKeyRef.current === scheduleKey) {
      return;
    }

    const scheduleNotifications = async () => {
      const success = await schedulePrayerNotificationsRange({
        days: schedules,
        translator: t,
        translatePrayerName,
        contextKey,
        config,
        force: false,
      });

      if (success) {
        lastScheduleKeyRef.current = scheduleKey;
      }
    };

    scheduleNotifications().catch((error) => {
      console.error('Failed to schedule prayer notifications', error);
    });
  }, [
    prayerTimes,
    notificationsEnabled,
    t,
    translatePrayerName,
    language,
    location,
    notificationConfigVersion,
  ]);

  useEffect(() => {
    if (!notificationsEnabled) {
      lastScheduleKeyRef.current = null;
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!tahajjudEnabled) {
      cancelTahajjudNotification().catch((error) => {
        console.error('Failed to cancel tahajjud notification.', error);
      });
    }
  }, [tahajjudEnabled]);

  useEffect(() => {
    if (!notificationsEnabled) {
      cancelTahajjudNotification().catch((error) => {
        console.error('Failed to cancel tahajjud notification when notifications are disabled.', error);
      });
      return;
    }

    if (!tahajjudEnabled || !tahajjudTime) {
      return;
    }

    scheduleTahajjudNotification({ translator: t, time: tahajjudTime, leadMinutes: tahajjudLeadMinutes }).catch((error) => {
      console.error('Failed to schedule tahajjud notification.', error);
    });
  }, [notificationsEnabled, tahajjudEnabled, tahajjudTime, t, tahajjudLeadMinutes]);

  const handleOpenTahajjudSettings = useCallback(() => {
    navigation.navigate('TahajjudSettings');
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (errorKey) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t(errorKey)}</Text>
      </View>
    );
  }

  if (!prayerTimes) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('prayer.error.empty')}</Text>
      </View>
    );
  }

  const prayerItems = prayerTimes.prayers
    .map((prayer) => {
      const iconName = PRAYER_ICONS[prayer.name];
      if (!iconName) {
        return null;
      }

      return { prayer, iconName };
    })
    .filter((item): item is { prayer: PrayerTime; iconName: MaterialIconName } => item !== null);

  return (
    <ImageBackground
      source={require('../assets/images/background.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay} />
      <View style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.screenTitle}>{t('prayer.title')}</Text>
              <Text style={styles.hijriText}>{prayerTimes.hijriDate ?? prayerTimes.date}</Text>
            </View>
            <TouchableOpacity style={styles.locationButton} activeOpacity={0.75}>
              <Icon name="location-on" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {nextPrayer ? (
            <View style={styles.largeCard}>
              <Text style={styles.largeCardLabel}>{translatePrayerName(nextPrayer.name)}</Text>
              <Text style={styles.largeCardTime}>{formatTo12Hour(nextPrayer.time)}</Text>

              <View style={styles.countdownSection}>
                <Text style={styles.countdownLabel}>{t('prayer.nextPrayerIn')}</Text>
                <Text style={styles.countdownTime}>{countdown}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.prayersContainer}>
            {prayerItems.map(({ prayer, iconName }, index) => {
              const isNextPrayer = nextPrayer?.name === prayer.name;
              const isLast = index === prayerItems.length - 1;
              return (
                <View
                  key={prayer.name}
                  style={[
                    styles.prayerRow,
                    isNextPrayer && styles.prayerRowActive,
                    !isLast && styles.prayerRowSpacing,
                  ]}
                >
                  <View style={styles.prayerLeft}>
                    <Icon
                      name={iconName}
                      size={22}
                      color={isNextPrayer ? '#ffffff' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.prayerName,
                        isNextPrayer && styles.prayerNameActive,
                      ]}
                    >
                      {translatePrayerName(prayer.name)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.prayerTime,
                      isNextPrayer && styles.prayerTimeActive,
                    ]}
                  >
                    {formatTo12Hour(prayer.time)}
                  </Text>
                </View>
              );
            })}
            <TouchableOpacity
              style={[
                styles.tahajjudRow,
                tahajjudEnabled ? styles.tahajjudRowActive : styles.tahajjudRowInactive,
              ]}
              activeOpacity={0.85}
              onPress={handleOpenTahajjudSettings}
            >
              <View style={styles.tahajjudLeft}>
                <View style={styles.tahajjudIconWrapper}>
                  <Icon name="star" size={20} color="#60a5fa" />
                </View>
                <View style={styles.tahajjudTextGroup}>
                  <Text style={styles.tahajjudTitle}>{t('prayer.tahajjud.ctaTitle')}</Text>
                  <Text style={styles.tahajjudSubtitle}>{t('prayer.tahajjud.ctaSubtitle')}</Text>
                </View>
              </View>
              <View style={styles.tahajjudRight}>
                {tahajjudEnabled && tahajjudTime ? (
                  <View style={styles.tahajjudBadge}>
                    <Text style={styles.tahajjudBadgeText}>{formatTahajjudTime(tahajjudTime)}</Text>
                    <Text style={styles.tahajjudBadgeSubText}>
                      {formatLeadLabel(tahajjudLeadMinutes)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tahajjudSetupText}>{t('tahajjud.setupAction')}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

export default PrayerTimeScreen;

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
    marginBottom: 8,
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
    marginBottom: 4,
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
  tahajjudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(12, 18, 34, 0.85)',
    shadowColor: 'rgba(59, 130, 246, 0.35)',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  tahajjudRowActive: {
    borderColor: 'rgba(96, 165, 250, 0.75)',
    backgroundColor: 'rgba(30, 64, 175, 0.25)',
  },
  tahajjudRowInactive: {
    opacity: 0.94,
  },
  tahajjudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  tahajjudIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  tahajjudTextGroup: {
    marginLeft: 16,
    flex: 1,
  },
  tahajjudTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tahajjudSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  tahajjudRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tahajjudBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  tahajjudBadgeText: {
    color: '#dbeafe',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tahajjudBadgeSubText: {
    marginTop: 4,
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  tahajjudSetupText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
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
    marginTop: 4,
  },
  prayerRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  prayerRowActive: {
    borderColor: 'rgba(56, 189, 248, 0.5)',
    backgroundColor: 'rgba(30, 64, 175, 0.28)',
    shadowColor: 'rgba(56, 189, 248, 0.45)',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  prayerRowSpacing: {
    marginBottom: 4,
  },
  prayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
