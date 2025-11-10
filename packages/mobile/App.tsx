// @ts-nocheck

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
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

import { I18nProvider } from './i18n';
import { initializeNotifications } from './notifications/notificationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
      setLocation(storedLocation);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeNotifications();
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

export default App;