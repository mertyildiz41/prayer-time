// @ts-nocheck

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [twentyFourHourClock, setTwentyFourHourClock] = useState(false);

  const handleChangeLocation = () => {
    navigation.dispatch(StackActions.replace('LocationSearch'));
  };

  const renderSectionHeader = (label: string) => (
    <Text style={styles.sectionHeader}>{label}</Text>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Customize your prayer reminders and preferences.</Text>

      {renderSectionHeader('Notifications')}
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Daily reminders</Text>
          <Text style={styles.rowSubtitle}>Receive alerts for upcoming prayer times.</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ false: '#1f2937', true: '#3b82f6' }}
          thumbColor={notificationsEnabled ? '#93c5fd' : '#e5e7eb'}
        />
      </View>

      {renderSectionHeader('Prayer Time')}
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>24-hour clock</Text>
          <Text style={styles.rowSubtitle}>Switch between 12-hour and 24-hour formats.</Text>
        </View>
        <Switch
          value={twentyFourHourClock}
          onValueChange={setTwentyFourHourClock}
          trackColor={{ false: '#1f2937', true: '#3b82f6' }}
          thumbColor={twentyFourHourClock ? '#93c5fd' : '#e5e7eb'}
        />
      </View>

      <TouchableOpacity style={styles.actionCard} onPress={handleChangeLocation}>
        <Text style={styles.actionTitle}>Change Location</Text>
        <Text style={styles.actionSubtitle}>Update your city to refresh prayer calculations.</Text>
        <Text style={styles.actionLink}>Choose Location</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
        <Text style={styles.actionTitle}>Feedback</Text>
        <Text style={styles.actionSubtitle}>Let us know how we can make PrayerTime better.</Text>
        <Text style={styles.actionLink}>Send Feedback</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>PrayerTime v1.0.0</Text>
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
  versionText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default SettingsScreen;
