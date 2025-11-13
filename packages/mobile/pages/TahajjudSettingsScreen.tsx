// @ts-nocheck

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from '@react-native-vector-icons/material-icons';
import Slider from '@react-native-community/slider';

import { useTranslation } from '../i18n';
import { settingsStorage } from '../storage/settingsStorage';
import { locationStorage } from '../storage/locationStorage';
import {
  scheduleTahajjudNotification,
  cancelTahajjudNotification,
} from '../notifications/notificationService';
import TahajjudTimePickerModal from '../components/TahajjudTimePickerModal';
import {
  computeNightWindow,
  computeTahajjudReminderTime,
  type TahajjudReminderMethod,
} from '../utils/tahajjudTime';

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

const METHOD_OPTIONS: TahajjudReminderMethod[] = ['lastThird', 'middle', 'custom'];
const MAX_LEAD_MINUTES = 120;
const LEAD_STEP = 5;

const ensureValidTime = (time: string | null | undefined, fallback: string): string => {
  if (typeof time === 'string' && time.length >= 4) {
    return time;
  }
  return fallback;
};

const resolveReminderTime = (
  method: TahajjudReminderMethod,
  locationAvailable: boolean,
  args: { customTime: string; storedTime: string | null },
): string => {
  if (method === 'custom') {
    return ensureValidTime(args.customTime, args.storedTime ?? '02:30');
  }

  if (!locationAvailable) {
    return ensureValidTime(args.storedTime, args.customTime);
  }

  const location = locationStorage.get();
  if (!location) {
    return ensureValidTime(args.storedTime, args.customTime);
  }

  const { time } = computeTahajjudReminderTime({
    method,
    location,
    customTime: args.customTime,
    fallbackTime: args.storedTime ?? args.customTime,
  });

  return time;
};

const TahajjudSettingsScreen = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const location = locationStorage.get();
  const notificationsEnabled = settingsStorage.getNotificationsEnabled();
  const twentyFourHourClock = settingsStorage.getTwentyFourHourPreference();

  const persistedEnabled = settingsStorage.getTahajjudReminderEnabled();
  const persistedMethod = settingsStorage.getTahajjudReminderMethod();
  const persistedTime = settingsStorage.getTahajjudReminderTime();
  const persistedCustomTime = settingsStorage.getTahajjudReminderCustomTime() ?? persistedTime ?? '02:30';
  const persistedLead = settingsStorage.getTahajjudReminderLeadMinutes();

  const [enabled, setEnabled] = useState<boolean>(persistedEnabled);
  const [method, setMethod] = useState<TahajjudReminderMethod>(persistedMethod);
  const [customTime, setCustomTime] = useState<string>(ensureValidTime(persistedCustomTime, '02:30'));
  const [reminderTime, setReminderTime] = useState<string>(() =>
    resolveReminderTime(persistedMethod, Boolean(location), {
      customTime: ensureValidTime(persistedCustomTime, '02:30'),
      storedTime: persistedTime,
    }),
  );
  const [leadMinutes, setLeadMinutes] = useState<number>(persistedLead);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const nightWindow = useMemo(() => {
    if (!location) {
      return null;
    }
    return computeNightWindow(location, new Date(), 'Karachi');
  }, [location]);

  const nightEndTime = useMemo(() => {
    if (!nightWindow?.fajr) {
      return null;
    }
    const hours = String(nightWindow.fajr.getHours()).padStart(2, '0');
    const minutes = String(nightWindow.fajr.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [nightWindow]);

  const formatTime = useCallback(
    (time: string | null) => {
      if (!time) {
        return t('settings.notifications.tahajjud.timeUnset');
      }
      return twentyFourHourClock ? time : formatTo12Hour(time);
    },
    [twentyFourHourClock, t],
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

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggleEnabled = useCallback(
    (value: boolean) => {
      if (value) {
        if (!notificationsEnabled) {
          Alert.alert(
            t('settings.notifications.tahajjud.title'),
            t('tahajjud.notificationsDisabled'),
          );
          return;
        }
        setEnabled(true);
        return;
      }

      setEnabled(false);
    },
    [notificationsEnabled, t],
  );

  const updateReminderForMethod = useCallback(
    (nextMethod: TahajjudReminderMethod, customOverride?: string) => {
      if (nextMethod === 'custom') {
        const nextCustomTime = ensureValidTime(customOverride ?? customTime, customTime);
        setMethod('custom');
        setCustomTime(nextCustomTime);
        setReminderTime(nextCustomTime);
        return;
      }

      if (!location) {
        Alert.alert(
          t('settings.notifications.tahajjud.title'),
          t('tahajjud.locationMissing'),
        );
        return;
      }

      const { time } = computeTahajjudReminderTime({
        method: nextMethod,
        location,
        customTime,
        fallbackTime: reminderTime,
      });
      setMethod(nextMethod);
      setReminderTime(time);
    },
    [location, customTime, reminderTime, t],
  );

  const handleMethodSelect = useCallback(
    (nextMethod: TahajjudReminderMethod) => {
      updateReminderForMethod(nextMethod);
    },
    [updateReminderForMethod],
  );

  const handleCustomTimePress = useCallback(() => {
    setPickerVisible(true);
  }, []);

  const handleCustomTimeSelect = useCallback(
    (time: string) => {
      setPickerVisible(false);
      setCustomTime(time);
      setMethod('custom');
      setReminderTime(time);
    },
    [],
  );

  const handleSliderChange = useCallback((value: number) => {
    setLeadMinutes(Math.round(value));
  }, []);

  const handleSave = useCallback(async () => {
    if (enabled && !reminderTime) {
      Alert.alert(
        t('settings.notifications.tahajjud.title'),
        t('tahajjud.timeMissing'),
      );
      return;
    }

    if (enabled && !notificationsEnabled) {
      Alert.alert(
        t('settings.notifications.tahajjud.title'),
        t('tahajjud.notificationsDisabled'),
      );
      return;
    }

    setSaving(true);
    try {
      if (!enabled) {
        if (reminderTime) {
          settingsStorage.setTahajjudReminderTime(reminderTime);
        }
        settingsStorage.setTahajjudReminderMethod(method);
        settingsStorage.setTahajjudReminderLeadMinutes(leadMinutes);
        if (method === 'custom') {
          settingsStorage.setTahajjudReminderCustomTime(customTime);
        }
        settingsStorage.setTahajjudReminderEnabled(false);
        await cancelTahajjudNotification();
        Alert.alert(
          t('settings.notifications.tahajjud.title'),
          t('tahajjud.disabledSuccess'),
        );
        return;
      }

      const scheduled = await scheduleTahajjudNotification({
        translator: t,
        time: reminderTime,
        leadMinutes,
      });

      if (!scheduled) {
        Alert.alert(
          t('settings.notifications.tahajjud.title'),
          t('tahajjud.scheduleFailed'),
        );
        return;
      }

      if (reminderTime) {
        settingsStorage.setTahajjudReminderTime(reminderTime);
      }
      settingsStorage.setTahajjudReminderMethod(method);
      settingsStorage.setTahajjudReminderLeadMinutes(leadMinutes);
      if (method === 'custom') {
        settingsStorage.setTahajjudReminderCustomTime(customTime);
      }
      settingsStorage.setTahajjudReminderEnabled(true);

      Alert.alert(
        t('settings.notifications.tahajjud.title'),
        t('tahajjud.scheduledSuccess', { time: formatTime(reminderTime) }),
      );
    } catch (error) {
      console.error('Failed to save tahajjud settings.', error);
      Alert.alert(
        t('settings.notifications.tahajjud.title'),
        t('tahajjud.scheduleFailed'),
      );
    } finally {
      setSaving(false);
    }
  }, [enabled, reminderTime, notificationsEnabled, method, leadMinutes, customTime, t, formatTime]);

  const startTimeInteractive = method === 'custom';
  const formattedStart = formatTime(reminderTime);
  const formattedEnd = formatTime(nightEndTime);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} activeOpacity={0.8}>
          <Icon name="arrow-back" size={22} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tahajjud.settingsTitle')}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.cardTitle}>{t('tahajjud.enableLabel')}</Text>
              <Text style={styles.cardSubtitle}>{t('settings.notifications.tahajjud.subtitle')}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: '#1f2937', true: '#2563eb' }}
              thumbColor={enabled ? '#bfdbfe' : '#e5e7eb'}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeading}>{t('tahajjud.calculationHeading')}</Text>
          <View style={styles.methodRow}>
            {METHOD_OPTIONS.map((option) => {
              const isActive = method === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.methodChip, isActive && styles.methodChipActive]}
                  onPress={() => handleMethodSelect(option)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.methodText, isActive && styles.methodTextActive]}>
                    {t(`tahajjud.method.${option}`)}
                  </Text>
                  {option !== 'custom' ? (
                    <Icon
                      name="info-outline"
                      size={16}
                      color={isActive ? '#e2e8f0' : '#94a3b8'}
                      style={styles.methodInfoIcon}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeading}>{t('tahajjud.customWindowHeading')}</Text>
          <View style={styles.timeFieldRow}>
            <Text style={styles.timeFieldLabel}>{t('tahajjud.startTimeLabel')}</Text>
            <TouchableOpacity
              style={[styles.timeFieldButton, !startTimeInteractive && styles.timeFieldButtonDisabled]}
              onPress={startTimeInteractive ? handleCustomTimePress : undefined}
              activeOpacity={startTimeInteractive ? 0.85 : 1}
            >
              <Text style={styles.timeFieldValue}>{formattedStart}</Text>
              {startTimeInteractive ? (
                <Icon name="schedule" size={18} color="#60a5fa" />
              ) : (
                <Icon name="lock" size={18} color="#64748b" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.timeFieldRow}>
            <Text style={styles.timeFieldLabel}>{t('tahajjud.endTimeLabel')}</Text>
            <View style={[styles.timeFieldButton, styles.timeFieldButtonDisabled]}>
              <Text style={styles.timeFieldValue}>{formattedEnd}</Text>
              <Icon name="schedule" size={18} color="#475569" />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeading}>{t('tahajjud.remindersHeading')}</Text>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>{t('tahajjud.remindCaption')}</Text>
            <Text style={styles.sliderValue}>{formatLeadLabel(leadMinutes)}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={MAX_LEAD_MINUTES}
            step={LEAD_STEP}
            minimumTrackTintColor="#60a5fa"
            maximumTrackTintColor="#1e293b"
            thumbTintColor="#3b82f6"
            value={leadMinutes}
            onValueChange={handleSliderChange}
          />
          <View style={styles.alarmRow}>
            <View>
              <Text style={styles.alarmTitle}>{t('tahajjud.alarmSoundLabel')}</Text>
              <Text style={styles.alarmSubtitle}>{t('tahajjud.alarmSoundSubtitle')}</Text>
            </View>
            <View style={styles.alarmValue}>
              <Text style={styles.alarmValueText}>Adhan</Text>
              <Icon name="chevron-right" size={18} color="#94a3b8" />
            </View>
          </View>
        </View>
      </ScrollView>
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        activeOpacity={0.85}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? t('common.saving') : t('tahajjud.saveChanges')}</Text>
      </TouchableOpacity>
      <TahajjudTimePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleCustomTimeSelect}
        selectedTime={reminderTime}
        formatTime={(time) => formatTime(time)}
        title={t('tahajjud.picker.title')}
        description={t('tahajjud.picker.description')}
        cancelLabel={t('tahajjud.picker.cancel')}
      />
    </View>
  );
};

export default TahajjudSettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1324',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: 'rgba(11, 19, 36, 0.95)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    paddingTop: 16,
    gap: 18,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleText: {
    flex: 1,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeading: {
    color: '#64748b',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 12,
  },
  methodChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  methodChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  methodText: {
    color: '#cbd5f5',
    fontSize: 13,
    fontWeight: '600',
  },
  methodTextActive: {
    color: '#e2e8f0',
  },
  methodInfoIcon: {
    marginLeft: 4,
  },
  timeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  timeFieldLabel: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '500',
  },
  timeFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    minWidth: 140,
    gap: 8,
  },
  timeFieldButtonDisabled: {
    opacity: 0.65,
  },
  timeFieldValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sliderLabel: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '500',
  },
  sliderValue: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
  },
  alarmRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  alarmTitle: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '600',
  },
  alarmSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  alarmValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alarmValueText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    backgroundColor: '#2563eb',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
});
