// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { NavigationContainer, StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Country } from 'country-state-city';

import { RootStackParamList } from './navigation/types';
import PrayerTimeScreen from './pages/PrayerTimeScreen';
import { BottomNavBar } from './pages/BottomNavBar';
import LocationSearchScreen from './pages/LocationSearchScreen';
import { locationStorage } from './storage/locationStorage';
import QiblaScreen from './pages/QiblaScreen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import OnboardingScreen from './pages/OnboardingScreen';
import QuranScreen from './pages/QuranScreen';
import SettingsScreen from './pages/SettingsScreen';
import TahajjudSettingsScreen from './pages/TahajjudSettingsScreen';

import { I18nProvider, useLanguage, useTranslation } from './i18n';
import type { TranslationKey } from './i18n/translations';
import {
  initializeNotifications,
  schedulePrayerNotificationsRange,
  generatePrayerSchedules,
  cancelPrayerNotifications,
  scheduleTahajjudNotification,
  cancelTahajjudNotification,
  resetNotificationScheduleCache,
} from './notifications/notificationService';
import { settingsStorage } from './storage/settingsStorage';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SIGNIFICANT_TIME_CHANGE_THRESHOLD_MS = 60 * 1000;
const TIME_CHANGE_POLL_INTERVAL_MS = 30 * 1000;

type LocationParam = RootStackParamList['Qibla']['location'];
type StoredLocation = LocationParam | null;

const BOTTOM_NAV_ROUTES: Array<keyof RootStackParamList> = ['PrayerTime', 'Qibla', 'Quran', 'Settings'];

function App() {

  const [location, setLocation] = useState<StoredLocation>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList | undefined>(undefined);
  const [transitionAnimation, setTransitionAnimation] = useState<'slide_from_left' | 'slide_from_right'>('slide_from_right');

  const navigationRef = useRef<any>(null);

  const preloadedCountries = useMemo(() => Country.getAllCountries(), []);

  useEffect(() => {
    const storedLocation = locationStorage.get();
    if (storedLocation) {
      initializeNotifications();
      setLocation(storedLocation);
    }

    setIsLoading(false);
  }, []);

  const handleLocationSelect = useCallback(
    (selectedLocation: LocationParam) => {
      try {
        locationStorage.set(selectedLocation);
        setLocation(selectedLocation);
        setTransitionAnimation('slide_from_right');
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'PrayerTime', params: { location: selectedLocation } }],
        });
        setCurrentRouteName('PrayerTime');
      } catch (error) {
        console.error('Failed to save location.', error);
      }
    },
    [navigationRef],
  );

  const updateCurrentRoute = useCallback(() => {
    const route = navigationRef.current?.getCurrentRoute();
    if (route) {
      setCurrentRouteName(route.name as keyof RootStackParamList);
    }
  }, []);

  const handleNavBarNavigate = useCallback(
    (target: string) => {
      const nav = navigationRef.current;
      if (!nav) {
        return;
      }

      const normalizedTarget = target as keyof RootStackParamList;
      if (BOTTOM_NAV_ROUTES.includes(normalizedTarget)) {
        const currentIndex = currentRouteName ? BOTTOM_NAV_ROUTES.indexOf(currentRouteName) : -1;
        const targetIndex = BOTTOM_NAV_ROUTES.indexOf(normalizedTarget);
        if (currentIndex !== -1 && targetIndex !== -1) {
          setTransitionAnimation(targetIndex > currentIndex ? 'slide_from_right' : 'slide_from_left');
        } else {
          setTransitionAnimation('slide_from_right');
        }
      } else {
        setTransitionAnimation('slide_from_right');
      }

      if (target === 'PrayerTime') {
        if (!location) {
          return;
        }

        nav.dispatch(StackActions.replace('PrayerTime', { location }));
        return;
      }

      if (target === 'Qibla') {
        if (!location) {
          return;
        }

        nav.dispatch(StackActions.replace('Qibla', { location }));
        return;
      }

      nav.dispatch(StackActions.replace(target));
    },
    [currentRouteName, location],
  );

  const handleOnBoardingComplete = useCallback(() => {
    const nav = navigationRef.current;
    if (!nav) {
      return;
    }
    console.log('Onboarding complete, navigating to LocationSearch');
    setTransitionAnimation('slide_from_right');
    nav.reset({
      index: 0,
      routes: [{ name: 'LocationSearch' }],
    });
    setCurrentRouteName('LocationSearch');
  }, []);

  if (isLoading) {
    return null;
  }
  
  return (
    <I18nProvider>
      <NotificationBootstrapper />
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(10, 14, 26, 0.85)' }}>
          <NavigationContainer
            ref={navigationRef}
            onReady={updateCurrentRoute}
            onStateChange={updateCurrentRoute}
          >
            <Stack.Navigator
              initialRouteName={location ? 'PrayerTime' : 'Onboarding'}
              screenOptions={{ animation: transitionAnimation }}
            >
              <Stack.Screen name="PrayerTime" options={{ headerShown: false }}>
                {() => {
                  if (!location) {
                    return <View style={{ flex: 1 }} />;
                  }

                  return (
                    <View style={{ flex: 1 }}>
                      <PrayerTimeScreen location={location} />
                    </View>
                  );
                }}
              </Stack.Screen>
              <Stack.Screen name="Qibla" component={QiblaScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
                {() => {
                  return (
                    <OnboardingScreen onComplete={handleOnBoardingComplete} />
                  );
                }}
              </Stack.Screen>
              <Stack.Screen name="LocationSearch" options={{ headerShown: false }}>
                {() => {
                  return (
                    <LocationSearchScreen
                      onLocationSelect={handleLocationSelect}
                      initialCountries={preloadedCountries}
                    />
                  )
                }}
              </Stack.Screen>
              <Stack.Screen name="Quran" component={QuranScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
              <Stack.Screen name="TahajjudSettings" component={TahajjudSettingsScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
          {location && currentRouteName && currentRouteName !== 'LocationSearch' && (
            <BottomNavBar
              location={location}
              currentRoute={currentRouteName}
              onNavigate={handleNavBarNavigate}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </I18nProvider>
  );
}

const NotificationBootstrapper = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const lastTimeCheckRef = useRef<number>(Date.now());

  const refreshNotifications = useCallback(
    async (options?: { force?: boolean }) => {
      try {
        if (!settingsStorage.getNotificationsEnabled()) {
          await cancelTahajjudNotification();
          return;
        }

        const storedLocation = locationStorage.get();
        if (!storedLocation) {
          return;
        }

        const schedules = generatePrayerSchedules({
          location: storedLocation,
          startDate: new Date(),
          days: 30,
          method: 'Karachi',
        });

        if (!schedules.length) {
          await cancelPrayerNotifications();
          return;
        }

        const translatePrayerName = (name: string) => {
          const key = `prayer.name.${name.toLowerCase()}` as TranslationKey;
          const translated = t(key);
          return translated === key ? name : translated;
        };

        const contextKey = `${language}-${storedLocation.latitude}-${storedLocation.longitude}-${storedLocation.timezone}`;
        await schedulePrayerNotificationsRange({
          days: schedules,
          translator: t,
          translatePrayerName,
          contextKey,
          config: settingsStorage.getNotificationConfig(),
          force: options?.force ?? false,
        });

        const tahajjudEnabled = settingsStorage.getTahajjudReminderEnabled();
        const tahajjudTime = settingsStorage.getTahajjudReminderTime();

        if (tahajjudEnabled && tahajjudTime) {
          const leadMinutes = settingsStorage.getTahajjudReminderLeadMinutes();
          await scheduleTahajjudNotification({ translator: t, time: tahajjudTime, leadMinutes });
        } else {
          await cancelTahajjudNotification();
        }
      } catch (error) {
        console.error('Failed to ensure prayer notifications on launch.', error);
      }
    },
    [language, t],
  );

  useEffect(() => {
    refreshNotifications().catch((error) => {
      console.error('Failed to ensure prayer notifications on launch.', error);
    });
  }, [refreshNotifications]);

  useEffect(() => {
    const handleAppStateChange = (nextState: string) => {
      if (nextState !== 'active') {
        return;
      }

      const now = Date.now();
      const drift = Math.abs(now - lastTimeCheckRef.current);
      lastTimeCheckRef.current = now;

      if (drift > SIGNIFICANT_TIME_CHANGE_THRESHOLD_MS) {
        resetNotificationScheduleCache();
        refreshNotifications({ force: true }).catch((error) => {
          console.error('Failed to refresh notifications after app resume.', error);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refreshNotifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const previous = lastTimeCheckRef.current;
      const drift = Math.abs(now - previous);
      lastTimeCheckRef.current = now;

      if (drift > SIGNIFICANT_TIME_CHANGE_THRESHOLD_MS) {
        resetNotificationScheduleCache();
        refreshNotifications({ force: true }).catch((error) => {
          console.error('Failed to refresh notifications after time change.', error);
        });
      }
    }, TIME_CHANGE_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [refreshNotifications]);

  return null;
};

export default App;