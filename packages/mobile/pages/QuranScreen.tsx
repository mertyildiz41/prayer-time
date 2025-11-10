// @ts-nocheck

import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTranslation } from '../i18n';

const SURAH_LIST = [
  { number: 1, name: "Al-Fatiha", revelation: "Meccan", verses: 7 },
  { number: 2, name: "Al-Baqarah", revelation: "Medinan", verses: 286 },
  { number: 3, name: "Ali 'Imran", revelation: "Medinan", verses: 200 },
  { number: 18, name: "Al-Kahf", revelation: "Meccan", verses: 110 },
  { number: 36, name: "Ya-Sin", revelation: "Meccan", verses: 83 },
  { number: 55, name: "Ar-Rahman", revelation: "Medinan", verses: 78 },
  { number: 67, name: "Al-Mulk", revelation: "Meccan", verses: 30 },
  { number: 112, name: "Al-Ikhlas", revelation: "Meccan", verses: 4 },
];

const QuranScreen = () => {
  const { t } = useTranslation();
  const renderItem = ({ item }: { item: (typeof SURAH_LIST)[number] }) => (
    <TouchableOpacity activeOpacity={0.8} style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.number}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>
          {t('quran.cardSubtitle', {
            revelation: t(`quran.revelation.${item.revelation.toLowerCase()}`),
            count: item.verses,
          })}
        </Text>
      </View>
      <Text style={styles.cardAction}>{t('quran.readAction')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('quran.title')}</Text>
      <Text style={styles.subtitle}>
        {t('quran.subtitle')}
      </Text>
      <FlatList
        data={SURAH_LIST}
        keyExtractor={(item) => item.number.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    marginLeft: 18,
  },
  cardTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  cardAction: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default QuranScreen;
