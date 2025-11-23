// @ts-nocheck

import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

import { useTranslation } from '../i18n';

const SURAH_LIST = [
  { number: 1, name: "Al-Fatiha", revelation: "Meccan", verses: 7 },
  { number: 2, name: "Al-Baqarah", revelation: "Medinan", verses: 286 },
  { number: 3, name: "Ali 'Imran", revelation: "Medinan", verses: 200 },
  { number: 4, name: "An-Nisa", revelation: "Medinan", verses: 176 },
  { number: 5, name: "Al-Ma'idah", revelation: "Medinan", verses: 120 },
  { number: 6, name: "Al-An'am", revelation: "Meccan", verses: 165 },
  { number: 7, name: "Al-A'raf", revelation: "Meccan", verses: 206 },
  { number: 8, name: "Al-Anfal", revelation: "Medinan", verses: 75 },
  { number: 9, name: "At-Tawbah", revelation: "Medinan", verses: 129 },
  { number: 10, name: "Yunus", revelation: "Meccan", verses: 109 },
  { number: 11, name: "Hud", revelation: "Meccan", verses: 123 },
  { number: 12, name: "Yusuf", revelation: "Meccan", verses: 111 },
  { number: 13, name: "Ar-Ra'd", revelation: "Medinan", verses: 43 },
  { number: 14, name: "Ibrahim", revelation: "Meccan", verses: 52 },
  { number: 15, name: "Al-Hijr", revelation: "Meccan", verses: 99 },
  { number: 16, name: "An-Nahl", revelation: "Meccan", verses: 128 },
  { number: 17, name: "Al-Isra", revelation: "Meccan", verses: 111 },
  { number: 18, name: "Al-Kahf", revelation: "Meccan", verses: 110 },
  { number: 19, name: "Maryam", revelation: "Meccan", verses: 98 },
  { number: 20, name: "Ta-Ha", revelation: "Meccan", verses: 135 },
  { number: 21, name: "Al-Anbiya", revelation: "Meccan", verses: 112 },
  { number: 22, name: "Al-Hajj", revelation: "Medinan", verses: 78 },
  { number: 23, name: "Al-Mu'minun", revelation: "Meccan", verses: 118 },
  { number: 24, name: "An-Nur", revelation: "Medinan", verses: 64 },
  { number: 25, name: "Al-Furqan", revelation: "Meccan", verses: 77 },
  { number: 26, name: "Ash-Shu'ara", revelation: "Meccan", verses: 227 },
  { number: 27, name: "An-Naml", revelation: "Meccan", verses: 93 },
  { number: 28, name: "Al-Qasas", revelation: "Meccan", verses: 88 },
  { number: 29, name: "Al-Ankabut", revelation: "Meccan", verses: 69 },
  { number: 30, name: "Ar-Rum", revelation: "Meccan", verses: 60 },
  { number: 31, name: "Luqman", revelation: "Meccan", verses: 34 },
  { number: 32, name: "As-Sajdah", revelation: "Meccan", verses: 30 },
  { number: 33, name: "Al-Ahzab", revelation: "Medinan", verses: 73 },
  { number: 34, name: "Saba", revelation: "Meccan", verses: 54 },
  { number: 35, name: "Fatir", revelation: "Meccan", verses: 45 },
  { number: 36, name: "Ya-Sin", revelation: "Meccan", verses: 83 },
  { number: 37, name: "As-Saffat", revelation: "Meccan", verses: 182 },
  { number: 38, name: "Sad", revelation: "Meccan", verses: 88 },
  { number: 39, name: "Az-Zumar", revelation: "Meccan", verses: 75 },
  { number: 40, name: "Ghafir", revelation: "Meccan", verses: 85 },
  { number: 41, name: "Fussilat", revelation: "Meccan", verses: 54 },
  { number: 42, name: "Ash-Shura", revelation: "Meccan", verses: 53 },
  { number: 43, name: "Az-Zukhruf", revelation: "Meccan", verses: 89 },
  { number: 44, name: "Ad-Dukhan", revelation: "Meccan", verses: 59 },
  { number: 45, name: "Al-Jathiyah", revelation: "Meccan", verses: 37 },
  { number: 46, name: "Al-Ahqaf", revelation: "Meccan", verses: 35 },
  { number: 47, name: "Muhammad", revelation: "Medinan", verses: 38 },
  { number: 48, name: "Al-Fath", revelation: "Medinan", verses: 29 },
  { number: 49, name: "Al-Hujurat", revelation: "Medinan", verses: 18 },
  { number: 50, name: "Qaf", revelation: "Meccan", verses: 45 },
  { number: 51, name: "Adh-Dhariyat", revelation: "Meccan", verses: 60 },
  { number: 52, name: "At-Tur", revelation: "Meccan", verses: 49 },
  { number: 53, name: "An-Najm", revelation: "Meccan", verses: 62 },
  { number: 54, name: "Al-Qamar", revelation: "Meccan", verses: 55 },
  { number: 55, name: "Ar-Rahman", revelation: "Medinan", verses: 78 },
  { number: 56, name: "Al-Waqi'ah", revelation: "Meccan", verses: 96 },
  { number: 57, name: "Al-Hadid", revelation: "Medinan", verses: 29 },
  { number: 58, name: "Al-Mujadila", revelation: "Medinan", verses: 22 },
  { number: 59, name: "Al-Hashr", revelation: "Medinan", verses: 24 },
  { number: 60, name: "Al-Mumtahanah", revelation: "Medinan", verses: 13 },
  { number: 61, name: "As-Saff", revelation: "Medinan", verses: 14 },
  { number: 62, name: "Al-Jumu'ah", revelation: "Medinan", verses: 11 },
  { number: 63, name: "Al-Munafiqun", revelation: "Medinan", verses: 11 },
  { number: 64, name: "At-Taghabun", revelation: "Medinan", verses: 18 },
  { number: 65, name: "At-Talaq", revelation: "Medinan", verses: 12 },
  { number: 66, name: "At-Tahrim", revelation: "Medinan", verses: 12 },
  { number: 67, name: "Al-Mulk", revelation: "Meccan", verses: 30 },
  { number: 68, name: "Al-Qalam", revelation: "Meccan", verses: 52 },
  { number: 69, name: "Al-Haqqah", revelation: "Meccan", verses: 52 },
  { number: 70, name: "Al-Ma'arij", revelation: "Meccan", verses: 44 },
  { number: 71, name: "Nuh", revelation: "Meccan", verses: 28 },
  { number: 72, name: "Al-Jinn", revelation: "Meccan", verses: 28 },
  { number: 73, name: "Al-Muzzammil", revelation: "Meccan", verses: 20 },
  { number: 74, name: "Al-Muddaththir", revelation: "Meccan", verses: 56 },
  { number: 75, name: "Al-Qiyamah", revelation: "Meccan", verses: 40 },
  { number: 76, name: "Al-Insan", revelation: "Medinan", verses: 31 },
  { number: 77, name: "Al-Mursalat", revelation: "Meccan", verses: 50 },
  { number: 78, name: "An-Naba", revelation: "Meccan", verses: 40 },
  { number: 79, name: "An-Nazi'at", revelation: "Meccan", verses: 46 },
  { number: 80, name: "Abasa", revelation: "Meccan", verses: 42 },
  { number: 81, name: "At-Takwir", revelation: "Meccan", verses: 29 },
  { number: 82, name: "Al-Infitar", revelation: "Meccan", verses: 19 },
  { number: 83, name: "Al-Mutaffifin", revelation: "Meccan", verses: 36 },
  { number: 84, name: "Al-Inshiqaq", revelation: "Meccan", verses: 25 },
  { number: 85, name: "Al-Buruj", revelation: "Meccan", verses: 22 },
  { number: 86, name: "At-Tariq", revelation: "Meccan", verses: 17 },
  { number: 87, name: "Al-A'la", revelation: "Meccan", verses: 19 },
  { number: 88, name: "Al-Ghashiyah", revelation: "Meccan", verses: 26 },
  { number: 89, name: "Al-Fajr", revelation: "Meccan", verses: 30 },
  { number: 90, name: "Al-Balad", revelation: "Meccan", verses: 20 },
  { number: 91, name: "Ash-Shams", revelation: "Meccan", verses: 15 },
  { number: 92, name: "Al-Layl", revelation: "Meccan", verses: 21 },
  { number: 93, name: "Ad-Duha", revelation: "Meccan", verses: 11 },
  { number: 94, name: "Ash-Sharh", revelation: "Meccan", verses: 8 },
  { number: 95, name: "At-Tin", revelation: "Meccan", verses: 8 },
  { number: 96, name: "Al-Alaq", revelation: "Meccan", verses: 19 },
  { number: 97, name: "Al-Qadr", revelation: "Meccan", verses: 5 },
  { number: 98, name: "Al-Bayyinah", revelation: "Medinan", verses: 8 },
  { number: 99, name: "Az-Zalzalah", revelation: "Medinan", verses: 8 },
  { number: 100, name: "Al-Adiyat", revelation: "Meccan", verses: 11 },
  { number: 101, name: "Al-Qari'ah", revelation: "Meccan", verses: 11 },
  { number: 102, name: "At-Takathur", revelation: "Meccan", verses: 8 },
  { number: 103, name: "Al-Asr", revelation: "Meccan", verses: 3 },
  { number: 104, name: "Al-Humazah", revelation: "Meccan", verses: 9 },
  { number: 105, name: "Al-Fil", revelation: "Meccan", verses: 5 },
  { number: 106, name: "Quraysh", revelation: "Meccan", verses: 4 },
  { number: 107, name: "Al-Ma'un", revelation: "Meccan", verses: 7 },
  { number: 108, name: "Al-Kawthar", revelation: "Meccan", verses: 3 },
  { number: 109, name: "Al-Kafirun", revelation: "Meccan", verses: 6 },
  { number: 110, name: "An-Nasr", revelation: "Medinan", verses: 3 },
  { number: 111, name: "Al-Masad", revelation: "Meccan", verses: 5 },
  { number: 112, name: "Al-Ikhlas", revelation: "Meccan", verses: 4 },
  { number: 113, name: "Al-Falaq", revelation: "Meccan", verses: 5 },
  { number: 114, name: "An-Nas", revelation: "Meccan", verses: 6 },
];

const QuranScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const handleSurahPress = (surah: typeof SURAH_LIST[0]) => {
    navigation.navigate('QuranReader', {
      surahNumber: surah.number,
      surahName: surah.name,
    });
  };

  const renderItem = ({ item }: { item: (typeof SURAH_LIST)[number] }) => (
    <TouchableOpacity 
      activeOpacity={0.8} 
      style={styles.card}
      onPress={() => handleSurahPress(item)}
    >
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
