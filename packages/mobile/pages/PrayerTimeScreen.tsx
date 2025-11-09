import React, { useCallback, useEffect, useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@react-native-vector-icons/material-icons';
import { DailyPrayerTimes, Location, PrayerTime, PrayerTimeCalculator } from '@prayer-time/shared';

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
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');

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
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load prayer times');
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!prayerTimes) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No prayer times available</Text>
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
              <Text style={styles.screenTitle}>Prayer Times</Text>
              <Text style={styles.hijriText}>{prayerTimes.hijriDate ?? prayerTimes.date}</Text>
            </View>
            <TouchableOpacity style={styles.locationButton} activeOpacity={0.75}>
              <Icon name="location-on" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {nextPrayer ? (
            <View style={styles.largeCard}>
              <Text style={styles.largeCardLabel}>{nextPrayer.name}</Text>
              <Text style={styles.largeCardTime}>{formatTo12Hour(nextPrayer.time)}</Text>

              <View style={styles.countdownSection}>
                <Text style={styles.countdownLabel}>NEXT PRAYER IN</Text>
                <Text style={styles.countdownTime}>{countdown}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.prayersContainer}>
            {prayerItems.map(({ prayer, iconName }) => {
              const isNextPrayer = nextPrayer?.name === prayer.name;
              return (
                <View
                  key={prayer.name}
                  style={[
                    styles.prayerRow,
                    isNextPrayer && styles.prayerRowActive,
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
                      {prayer.name}
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
