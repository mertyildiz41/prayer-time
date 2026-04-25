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
  Modal,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-icons';
import { DailyPrayerTimes, Location, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';

import { useLanguage, useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import {
  PRAYER_NOTIFICATION_NAMES,
  schedulePrayerNotificationsRange,
  generatePrayerSchedules,
  buildNotificationConfigKey,
  scheduleTahajjudNotification,
  cancelTahajjudNotification,
} from '../notifications/notificationService';
import {
  createDefaultPrayerCheckState,
  addMissedPrayer,
  getPrayerCheckState,
  removeMissedPrayer,
  respondToPrayerCheck,
  subscribeToPrayerCheckState,
  type PrayerCheckState,
} from '../storage/prayerCheckStorage';
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

const formatDisplayTime = (time: string, twentyFourHourClock: boolean): string => {
  return twentyFourHourClock ? time : formatTo12Hour(time);
};

const PRAYER_ICONS: Partial<Record<PrayerTime['name'], MaterialIconName>> = {
  Fajr: 'wb-twilight',
  Dhuhr: 'wb-sunny',
  Asr: 'access-time',
  Maghrib: 'wb-twilight',
  Isha: 'nightlight',
};

const HOME_PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

function PrayerTimeScreen({ location }: PrayerTimeScreenProps) {
  const navigation = useNavigation();
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [notificationConfigVersion, setNotificationConfigVersion] = useState(0);
  const lastScheduleKeyRef = useRef<string | null>(null);
  const [tahajjudEnabled, setTahajjudEnabled] = useState<boolean>(false);
  const [tahajjudTime, setTahajjudTime] = useState<string | null>(null);
  const [tahajjudLeadMinutes, setTahajjudLeadMinutes] = useState<number>(0);
  const [twentyFourHourClock, setTwentyFourHourClock] = useState<boolean>(false);
  const [calculationMethod, setCalculationMethod] = useState<string>('Diyanet');
  const [prayerCheckModalVisible, setPrayerCheckModalVisible] = useState(false);
  const [prayerCheckState, setPrayerCheckState] = useState<PrayerCheckState>(() =>
    createDefaultPrayerCheckState()
  );

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

  const getHomePrayers = useCallback((prayers: PrayerTime[]) => {
    return prayers.filter((prayer) => HOME_PRAYER_NAMES.includes(prayer.name as (typeof HOME_PRAYER_NAMES)[number]));
  }, []);

  const pendingPrayerCheck = prayerCheckState.pending[0] ?? null;
  const totalMissedPrayers = PRAYER_NOTIFICATION_NAMES.reduce((total, prayerName) => {
    return total + (prayerCheckState.missedCounts[prayerName] ?? 0);
  }, 0);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        setNotificationsEnabled(await settingsStorage.getNotificationsEnabled());
        setNotificationConfigVersion((prev) => prev + 1);
        setTahajjudEnabled(await settingsStorage.getTahajjudReminderEnabled());
        setTahajjudTime(await settingsStorage.getTahajjudReminderTime());
        setTahajjudLeadMinutes(await settingsStorage.getTahajjudReminderLeadMinutes());
        setTwentyFourHourClock(await settingsStorage.getTwentyFourHourPreference());
        setCalculationMethod(await settingsStorage.getCalculationMethod() || 'Diyanet');
        setPrayerCheckState(await getPrayerCheckState());
        lastScheduleKeyRef.current = null;
      };
      loadSettings();
    }, []),
  );

  useEffect(() => {
    const unsubscribe = subscribeToPrayerCheckState((state) => {
      setPrayerCheckState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadPrayerTimes = useCallback(async () => {
    try {
      setLoading(true);
      const times = PrayerTimeCalculator.calculatePrayerTimes(
        new Date(),
        location,
        calculationMethod,
      );
      const homePrayers = getHomePrayers(times.prayers);
      setPrayerTimes(times);
      setNextPrayer(PrayerTimeCalculator.getNextPrayerTime(homePrayers));
      setErrorKey(null);
    } catch (err) {
      console.error(err);
      setErrorKey('prayer.error.load');
    } finally {
      setLoading(false);
    }
  }, [location, calculationMethod, getHomePrayers]);

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
      const upcoming = PrayerTimeCalculator.getNextPrayerTime(getHomePrayers(prayerTimes.prayers));
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
  }, [prayerTimes, getHomePrayers]);

  useEffect(() => {
    if (!prayerTimes || !notificationsEnabled) {
      return;
    }

    const scheduleNotifications = async () => {
      const config = await settingsStorage.getNotificationConfig();
      const schedules = generatePrayerSchedules({
        location,
        startDate: new Date(),
        days: 30,
        method: calculationMethod,
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
    calculationMethod,
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

  const handlePrayerCheckResponse = useCallback(async (response: 'yes' | 'no') => {
    if (!pendingPrayerCheck) {
      return;
    }

    try {
      const nextState = await respondToPrayerCheck(pendingPrayerCheck.id, response, pendingPrayerCheck);
      setPrayerCheckState(nextState);
    } catch (error) {
      console.error('Failed to record prayer check response.', error);
    }
  }, [pendingPrayerCheck]);

  const handleOpenTahajjudSettings = useCallback(() => {
    navigation.navigate('TahajjudSettings');
  }, [navigation]);

  const handleOpenPrayerCheckModal = useCallback(() => {
    setPrayerCheckModalVisible(true);
  }, []);

  const handleClosePrayerCheckModal = useCallback(() => {
    setPrayerCheckModalVisible(false);
  }, []);

  const handleAdjustMissedPrayer = useCallback(
    async (
      prayerName: (typeof PRAYER_NOTIFICATION_NAMES)[number],
      direction: 'add' | 'remove',
    ) => {
      try {
        const nextState =
          direction === 'add'
            ? await addMissedPrayer(prayerName)
            : await removeMissedPrayer(prayerName);
        setPrayerCheckState(nextState);
      } catch (error) {
        console.error('Failed to update missed prayer count.', error);
      }
    },
    [],
  );

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

  const prayerItems = getHomePrayers(prayerTimes.prayers)
    .map((prayer) => {
      const iconName = PRAYER_ICONS[prayer.name];
      if (!iconName) {
        return null;
      }

      return { prayer, iconName };
    })
    .filter((item): item is { prayer: PrayerTime; iconName: MaterialIconName } => item !== null);
  const sunsetPrayer = prayerTimes.prayers.find((prayer) => prayer.name === 'Sunset') ?? null;
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
              <Text style={styles.largeCardTime}>{formatDisplayTime(nextPrayer.time, twentyFourHourClock)}</Text>

              <View style={styles.countdownSection}>
                <Text style={styles.countdownLabel}>{t('prayer.nextPrayerIn')}</Text>
                <Text style={styles.countdownTime}>{countdown}</Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.checkInCard,
              (pendingPrayerCheck || totalMissedPrayers > 0) && styles.checkInCardActive,
            ]}
            activeOpacity={0.85}
            onPress={handleOpenPrayerCheckModal}
          >
            <View style={styles.checkInSummaryHeader}>
              <Text style={styles.checkInLabel}>{t('prayer.checkIn.title')}</Text>
              <View style={styles.checkInSummaryAction}>
                <Text style={styles.checkInSummaryActionText}>{t('prayer.checkIn.manageAction')}</Text>
                <Icon name="chevron-right" size={18} color="#7dd3fc" />
              </View>
            </View>
            <Text style={styles.checkInSummaryHint}>{t('prayer.checkIn.manageHint')}</Text>
          </TouchableOpacity>

          <View style={styles.prayersContainer}>
            {prayerItems.map(({ prayer, iconName }, index) => {
              const isNextPrayer = nextPrayer?.name === prayer.name;
              const isLast = index === prayerItems.length - 1;
              const showSunsetLabel = prayer.name === 'Fajr' && Boolean(sunsetPrayer);
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
                    <View style={styles.prayerTextGroup}>
                      <Text
                        style={[
                          styles.prayerName,
                          isNextPrayer && styles.prayerNameActive,
                        ]}
                      >
                        {translatePrayerName(prayer.name)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.prayerRight}>
                    <Text
                      style={[
                        styles.prayerTime,
                        isNextPrayer && styles.prayerTimeActive,
                      ]}
                    >
                      {formatDisplayTime(prayer.time, twentyFourHourClock)}
                    </Text>
                    {showSunsetLabel ? (
                      <Text
                        style={[
                          styles.prayerTimeSubtext,
                          isNextPrayer && styles.prayerTimeSubtextActive,
                        ]}
                      >
                        {translatePrayerName(sunsetPrayer!.name)} {formatDisplayTime(sunsetPrayer!.time, twentyFourHourClock)}
                      </Text>
                    ) : null}
                  </View>
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
      <Modal
        visible={prayerCheckModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleClosePrayerCheckModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleClosePrayerCheckModal} />
          <View style={styles.prayerCheckModal}>
            <View style={styles.prayerCheckModalHeader}>
              <View style={styles.prayerCheckModalTitleGroup}>
                <Text style={styles.prayerCheckModalTitle}>{t('prayer.checkIn.modalTitle')}</Text>
                <Text style={styles.prayerCheckModalDescription}>{t('prayer.checkIn.modalDescription')}</Text>
              </View>
              <TouchableOpacity
                style={styles.prayerCheckModalCloseIcon}
                activeOpacity={0.8}
                onPress={handleClosePrayerCheckModal}
              >
                <Icon name="close" size={20} color="#e2e8f0" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.prayerCheckModalContent}
              contentContainerStyle={styles.prayerCheckModalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.prayerCheckSection}>
                <Text style={styles.prayerCheckSectionTitle}>{t('prayer.checkIn.title')}</Text>
                {pendingPrayerCheck ? (
                  <>
                    <Text style={styles.checkInQuestion}>
                      {t('prayer.checkIn.question', {
                        prayer: translatePrayerName(pendingPrayerCheck.prayerName),
                      })}
                    </Text>
                    <Text style={styles.checkInMeta}>
                      {t('prayer.checkIn.meta', {
                        time: formatDisplayTime(pendingPrayerCheck.prayerTime, twentyFourHourClock),
                      })}
                    </Text>
                    <View style={styles.checkInActions}>
                      <TouchableOpacity
                        style={styles.checkInButton}
                        activeOpacity={0.85}
                        onPress={() => {
                          void handlePrayerCheckResponse('yes');
                        }}
                      >
                        <Text style={styles.checkInButtonText}>{t('prayer.checkIn.answerYes')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.checkInButton, styles.checkInButtonDanger]}
                        activeOpacity={0.85}
                        onPress={() => {
                          void handlePrayerCheckResponse('no');
                        }}
                      >
                        <Text style={styles.checkInButtonText}>{t('prayer.checkIn.answerNo')}</Text>
                      </TouchableOpacity>
                    </View>
                    {prayerCheckState.pending.length > 1 ? (
                      <Text style={styles.checkInPendingText}>
                        {t('prayer.checkIn.pendingMore', {
                          count: prayerCheckState.pending.length - 1,
                        })}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.prayerCheckEmptyText}>{t('prayer.checkIn.pendingNone')}</Text>
                )}
              </View>

              <View style={styles.prayerCheckSection}>
                <View style={styles.missedCardHeader}>
                  <Text style={styles.missedCardTitle}>{t('prayer.checkIn.missedTitle')}</Text>
                  <Text style={styles.missedCardCount}>
                    {t('prayer.checkIn.missedCount', { count: totalMissedPrayers })}
                  </Text>
                </View>
                <Text style={styles.manualAdjustHint}>{t('prayer.checkIn.manualAdjustHint')}</Text>
                {PRAYER_NOTIFICATION_NAMES.map((prayerName) => {
                  const count = prayerCheckState.missedCounts[prayerName] ?? 0;

                  return (
                    <View key={prayerName} style={styles.manualPrayerRow}>
                      <Text style={styles.manualPrayerName}>{translatePrayerName(prayerName)}</Text>
                      <View style={styles.manualPrayerActions}>
                        <TouchableOpacity
                          style={[
                            styles.manualPrayerAction,
                            count === 0 && styles.manualPrayerActionDisabled,
                          ]}
                          activeOpacity={0.85}
                          disabled={count === 0}
                          onPress={() => {
                            void handleAdjustMissedPrayer(prayerName, 'remove');
                          }}
                        >
                          <Icon name="remove" size={18} color={count === 0 ? '#64748b' : '#f8fafc'} />
                        </TouchableOpacity>
                        <Text style={styles.manualPrayerCount}>{String(count)}</Text>
                        <TouchableOpacity
                          style={styles.manualPrayerAction}
                          activeOpacity={0.85}
                          onPress={() => {
                            void handleAdjustMissedPrayer(prayerName, 'add');
                          }}
                        >
                          <Icon name="add" size={18} color="#f8fafc" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.prayerCheckModalCloseButton}
              activeOpacity={0.85}
              onPress={handleClosePrayerCheckModal}
            >
              <Text style={styles.prayerCheckModalCloseButtonText}>{t('prayer.checkIn.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  checkInCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
  },
  checkInCardActive: {
    borderColor: 'rgba(248, 113, 113, 0.36)',
    backgroundColor: 'rgba(30, 41, 59, 0.94)',
  },
  checkInLabel: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  checkInSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkInSummaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  checkInSummaryActionText: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '600',
  },
  checkInQuestion: {
    marginTop: 8,
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  checkInMeta: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  checkInActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  checkInButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.4)',
  },
  checkInButtonDanger: {
    backgroundColor: 'rgba(153, 27, 27, 0.9)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  checkInButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkInPendingText: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 12,
  },
  checkInSummaryText: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  checkInSummaryHint: {
    marginTop: 12,
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
  missedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  missedCardTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  missedCardCount: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
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
    flex: 1,
    marginRight: 16,
  },
  prayerTextGroup: {
    flexShrink: 1,
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
  prayerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
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
  prayerTimeSubtext: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  prayerTimeSubtextActive: {
    color: '#bfdbfe',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  prayerCheckModal: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '82%',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.22)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  prayerCheckModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  prayerCheckModalTitleGroup: {
    flex: 1,
  },
  prayerCheckModalTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  prayerCheckModalDescription: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  prayerCheckModalCloseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  prayerCheckModalContent: {
    marginTop: 20,
  },
  prayerCheckModalContentContainer: {
    paddingBottom: 8,
  },
  prayerCheckSection: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  prayerCheckSectionTitle: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prayerCheckEmptyText: {
    marginTop: 10,
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  manualAdjustHint: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  manualPrayerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  manualPrayerName: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  manualPrayerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualPrayerAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.32)',
  },
  manualPrayerActionDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.72)',
    borderColor: 'rgba(100, 116, 139, 0.25)',
  },
  manualPrayerCount: {
    minWidth: 24,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  prayerCheckModalCloseButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.35)',
  },
  prayerCheckModalCloseButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
