// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-icons';
import Slider from '@react-native-community/slider';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from '../i18n';
import { quranStorage } from '../storage/quranStorage';

type QuranReaderScreenProps = NativeStackScreenProps<RootStackParamList, 'QuranReader'>;

// Sample verse data structure - in production, fetch from API
type Verse = {
  number: number;
  text: string;
  translation: string;
  transliteration?: string;
};

// Sample verses for Al-Fatiha - replace with API call
const SAMPLE_VERSES: Verse[] = [
  {
    number: 1,
    text: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    translation: '[All] praise is [due] to Allah, Lord of the worlds -',
    transliteration: 'Bismillahir Rahmanir Raheem',
  },
  {
    number: 2,
    text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    translation: '[All] praise is [due] to Allah, Lord of the worlds -',
    transliteration: 'Alhamdulillahi Rabbil \'Alamin',
  },
  {
    number: 3,
    text: 'الرَّحْمَنِ الرَّحِيمِ',
    translation: 'The Entirely Merciful, the Especially Merciful,',
    transliteration: 'Ar-Rahmanir Raheem',
  },
  {
    number: 4,
    text: 'مَالِكِ يَوْمِ الدِّينِ',
    translation: 'Sovereign of the Day of Recompense.',
    transliteration: 'Maliki Yawmid Din',
  },
  {
    number: 5,
    text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    translation: 'It is You we worship and You we ask for help.',
    transliteration: 'Iyyaka na\'budu wa iyyaka nasta\'in',
  },
  {
    number: 6,
    text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
    translation: 'Guide us to the straight path -',
    transliteration: 'Ihdinas Siratal Mustaqeem',
  },
  {
    number: 7,
    text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    translation: 'The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray.',
    transliteration: 'Siratal Ladhina An\'amta \'Alayhim Ghayril Maghdubi \'Alayhim Wa Lad-Dallin',
  },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SETTINGS_PANEL_HEIGHT = SCREEN_HEIGHT * 0.65;

const QuranReaderScreen: React.FC<QuranReaderScreenProps> = ({ route, navigation }) => {
  const { surahNumber, surahName } = route.params;
  const { t } = useTranslation();

  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [arabicFontSize, setArabicFontSize] = useState(28);
  const [translationFontSize, setTranslationFontSize] = useState(16);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [translationVersion, setTranslationVersion] = useState('Sahih International');
  const [reciter, setReciter] = useState('Mishary Rashid Alafasy');
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  const [currentScrollY, setCurrentScrollY] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchVerses = async () => {
      setLoading(true);
      try {
        // Fetch Arabic text and English translation from Al-Quran Cloud API
        const [arabicResponse, translationResponse] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/en.asad`), // English translation by Muhammad Asad
        ]);

        if (!arabicResponse.ok || !translationResponse.ok) {
          throw new Error('Failed to fetch Quran verses');
        }

        const arabicData = await arabicResponse.json();
        const translationData = await translationResponse.json();

        if (arabicData.code !== 200 || translationData.code !== 200) {
          throw new Error('API returned an error');
        }

        // Map the API response to our Verse format
        const arabicVerses = arabicData.data?.ayahs || [];
        const translationVerses = translationData.data?.ayahs || [];

        const mappedVerses: Verse[] = arabicVerses.map((ayah: any, index: number) => {
          const translation = translationVerses[index]?.text || '';
          return {
            number: ayah.numberInSurah,
            text: ayah.text,
            translation: translation,
            transliteration: undefined, // API doesn't provide transliteration by default
          };
        });

        setVerses(mappedVerses);
      } catch (error: any) {
        console.error('[QuranReader] Error fetching verses:', error);
        // Fallback to sample verses if API fails
        if (surahNumber === 1) {
          setVerses(SAMPLE_VERSES);
        } else {
          // For other Surahs, show error message
          setVerses([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchVerses();
    // Reset restoration flag when surah changes
    setHasRestoredPosition(false);
  }, [surahNumber]);

  // Restore scroll position when verses are loaded
  useEffect(() => {
    if (verses.length > 0 && !hasRestoredPosition && scrollViewRef.current) {
      const savedPosition = quranStorage.getReadingPosition(surahNumber);
      if (savedPosition !== null && savedPosition > 0) {
        // Small delay to ensure ScrollView is fully rendered
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: savedPosition,
            animated: false,
          });
          setHasRestoredPosition(true);
        }, 100);
      } else {
        setHasRestoredPosition(true);
      }
    }
  }, [verses, surahNumber, hasRestoredPosition]);

  // Save scroll position when scrolling (debounced)
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setCurrentScrollY(scrollY);
    
    // Clear existing timeout
    if (scrollPositionSaveTimeout.current) {
      clearTimeout(scrollPositionSaveTimeout.current);
    }
    
    // Debounce: save position 500ms after user stops scrolling
    scrollPositionSaveTimeout.current = setTimeout(() => {
      quranStorage.saveReadingPosition(surahNumber, scrollY);
    }, 500);
  };

  // Save position when navigating away or component unmounts
  useEffect(() => {
    return () => {
      // Clear any pending timeout
      if (scrollPositionSaveTimeout.current) {
        clearTimeout(scrollPositionSaveTimeout.current);
      }
      
      // Save current scroll position immediately before unmounting
      if (currentScrollY > 0) {
        quranStorage.saveReadingPosition(surahNumber, currentScrollY);
      }
    };
  }, [surahNumber, currentScrollY]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: showSettings ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [showSettings]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (showSettings && gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy / SETTINGS_PANEL_HEIGHT);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          setShowSettings(false);
        } else {
          Animated.spring(slideAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  const settingsPanelTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SETTINGS_PANEL_HEIGHT, 0],
  });

  const renderVerse = (verse: Verse) => (
    <View key={verse.number} style={styles.verseContainer}>
      <View style={styles.verseNumberContainer}>
        <View style={styles.verseNumberBadge}>
          <Text style={styles.verseNumber}>{verse.number}</Text>
        </View>
      </View>
      <View style={styles.verseContent}>
        <Text style={[styles.arabicText, { fontSize: arabicFontSize }]}>{verse.text}</Text>
        {showTransliteration && verse.transliteration && (
          <Text style={[styles.transliterationText, { fontSize: translationFontSize - 2 }]}>
            {verse.transliteration}
          </Text>
        )}
        {showTranslation && (
          <Text style={[styles.translationText, { fontSize: translationFontSize }]}>
            {verse.translation}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>{t('quran.reader.loading')}</Text>
      </View>
    );
  }

  if (verses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="error-outline" size={48} color="#ef4444" />
        <Text style={styles.loadingText}>
          {t('quran.reader.error') || 'Failed to load verses. Please check your internet connection.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            // Re-fetch verses
            const fetchVerses = async () => {
              try {
                const [arabicResponse, translationResponse] = await Promise.all([
                  fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`),
                  fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/en.asad`),
                ]);

                if (!arabicResponse.ok || !translationResponse.ok) {
                  throw new Error('Failed to fetch Quran verses');
                }

                const arabicData = await arabicResponse.json();
                const translationData = await translationResponse.json();

                if (arabicData.code !== 200 || translationData.code !== 200) {
                  throw new Error('API returned an error');
                }

                const arabicVerses = arabicData.data?.ayahs || [];
                const translationVerses = translationData.data?.ayahs || [];

                const mappedVerses: Verse[] = arabicVerses.map((ayah: any, index: number) => {
                  const translation = translationVerses[index]?.text || '';
                  return {
                    number: ayah.numberInSurah,
                    text: ayah.text,
                    translation: translation,
                    transliteration: undefined,
                  };
                });

                setVerses(mappedVerses);
              } catch (error: any) {
                console.error('[QuranReader] Error fetching verses:', error);
                if (surahNumber === 1) {
                  setVerses(SAMPLE_VERSES);
                }
              } finally {
                setLoading(false);
              }
            };
            fetchVerses();
          }}
        >
          <Text style={styles.retryButtonText}>
            {t('quran.reader.retry') || 'Retry'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{surahName}</Text>
          <Text style={styles.headerSubtitle}>
            {t('quran.reader.subtitle', { count: verses.length })}
          </Text>
        </View>
        <View style={styles.headerRightButtons}>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="bookmark-border" size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowSettings(true)}
          >
            <Icon name="settings" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {verses.map(renderVerse)}
      </ScrollView>

      {/* Settings Panel */}
      <Modal
        visible={showSettings}
        transparent
        animationType="none"
        onRequestClose={() => setShowSettings(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettings(false)}
        >
          <Animated.View
            style={[
              styles.settingsPanel,
              {
                transform: [{ translateY: settingsPanelTranslateY }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandle} />
            <Text style={styles.settingsTitle}>{t('quran.reader.displaySettings')}</Text>

            {/* Arabic Font Size */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>{t('quran.reader.arabicFontSize')}</Text>
              <Slider
                style={styles.slider}
                minimumValue={20}
                maximumValue={40}
                value={arabicFontSize}
                onValueChange={setArabicFontSize}
                minimumTrackTintColor="#22c55e"
                maximumTrackTintColor="#1e3a8a"
                thumbTintColor="#22c55e"
              />
            </View>

            {/* Translation Font Size */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>{t('quran.reader.translationFontSize')}</Text>
              <Slider
                style={styles.slider}
                minimumValue={12}
                maximumValue={24}
                value={translationFontSize}
                onValueChange={setTranslationFontSize}
                minimumTrackTintColor="#22c55e"
                maximumTrackTintColor="#1e3a8a"
                thumbTintColor="#22c55e"
              />
            </View>

            {/* Show Translation Toggle */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t('quran.reader.showTranslation')}</Text>
              <TouchableOpacity
                style={[styles.toggle, showTranslation && styles.toggleActive]}
                onPress={() => setShowTranslation(!showTranslation)}
              >
                <View style={[styles.toggleThumb, showTranslation && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {/* Show Transliteration Toggle */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t('quran.reader.showTransliteration')}</Text>
              <TouchableOpacity
                style={[styles.toggle, showTransliteration && styles.toggleActive]}
                onPress={() => setShowTransliteration(!showTransliteration)}
              >
                <View style={[styles.toggleThumb, showTransliteration && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {/* Translation Selection */}
            <TouchableOpacity style={styles.selectionRow}>
              <View>
                <Text style={styles.selectionLabel}>{t('quran.reader.translation')}</Text>
                <Text style={styles.selectionValue}>{translationVersion}</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#94a3b8" />
            </TouchableOpacity>

            {/* Reciter Selection */}
            <TouchableOpacity style={styles.selectionRow}>
              <View>
                <Text style={styles.selectionLabel}>{t('quran.reader.reciter')}</Text>
                <Text style={styles.selectionValue}>{reciter}</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e1a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#0a0e1a',
  },
  headerButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
  },
  verseContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  verseNumberContainer: {
    marginRight: 16,
  },
  verseNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseNumber: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
  },
  verseContent: {
    flex: 1,
  },
  arabicText: {
    color: '#e2e8f0',
    fontSize: 28,
    lineHeight: 48,
    textAlign: 'right',
    marginBottom: 12,
    fontFamily: 'System', // Use Arabic font if available
  },
  transliterationText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  translationText: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsPanel: {
    height: SETTINGS_PANEL_HEIGHT,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#64748b',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
  },
  settingSection: {
    marginBottom: 32,
  },
  settingLabel: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#475569',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#22c55e',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    marginBottom: 16,
  },
  selectionLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  selectionValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuranReaderScreen;

