import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './navigation/types';
import PrayerTimeScreen from './pages/PrayerTimeScreen';
import { BottomNavBar } from './pages/BottomNavBar';
import LocationSearchScreen from './pages/LocationSearchScreen';
import { locationStorage } from './storage/locationStorage';

const Stack = createNativeStackNavigator<RootStackParamList>();

type LocationParam = RootStackParamList['PrayerTime']['location'];
type StoredLocation = LocationParam | null;

function App() {

  const [location, setLocation] = useState<StoredLocation>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigationRef = useRef<any>(null);

  useEffect(() => {
    const storedLocation = locationStorage.get();

    if (storedLocation) {
      setLocation(storedLocation);
    }

    setIsLoading(false);
  }, []);

  const handleLocationSelect = useCallback(
    (selectedLocation: LocationParam) => {
      try {
        locationStorage.set(selectedLocation);
        setLocation(selectedLocation);
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'PrayerTime' }],
        });
      } catch (error) {
        console.error('Failed to save location.', error);
      }
    },
    [navigationRef],
  );

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName={location ? 'PrayerTime' : 'LocationSearch'}>
        <Stack.Screen name="PrayerTime" options={{ headerShown: false }}>
          {() => {
            if (!location) {
              return <View style={{ flex: 1 }} />;
            }

            return (
              <View style={{ flex: 1 }}>
                <PrayerTimeScreen location={location} />
                <BottomNavBar />
              </View>
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="LocationSearch" options={{ headerShown: false }}>
          {() => {
            return (
              <LocationSearchScreen onLocationSelect={handleLocationSelect} />
            )
          }}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;