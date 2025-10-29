import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PrayerTimeScreen from './screens/PrayerTimeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LocationSearchScreen from './screens/LocationSearchScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [location, setLocation] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkLocation = async () => {
      try {
        const storedLocation = await AsyncStorage.getItem('userLocation');
        if (storedLocation) {
          setLocation(JSON.parse(storedLocation));
        }
      } catch (e) {
        console.error("Failed to load location.", e);
      } finally {
        setIsLoading(false);
      }
    };

    checkLocation();
  }, []);

  const handleLocationSelect = async (selectedLocation: any) => {
    try {
      await AsyncStorage.setItem('userLocation', JSON.stringify(selectedLocation));
      setLocation(selectedLocation);
    } catch (e) {
      console.error("Failed to save location.", e);
    }
  };

  if (isLoading) {
    return null; // or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!location ? (
          <>
            <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
              {(props) => <OnboardingScreen {...props} onComplete={() => props.navigation.navigate('LocationSearch')} />}
            </Stack.Screen>
            <Stack.Screen name="LocationSearch" options={{ headerShown: false }}>
              {(props) => <LocationSearchScreen {...props} onLocationSelect={handleLocationSelect} />}
            </Stack.Screen>
          </>
        ) : (
          <Stack.Screen
            name="PrayerTime"
            component={PrayerTimeScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
