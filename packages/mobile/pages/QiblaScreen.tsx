import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, TouchableOpacity } from 'react-native';
import CompassHeading from 'react-native-compass-heading';
import { PrayerTimeCalculator } from '@prayer-time/shared';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';

type QiblaScreenProps = NativeStackScreenProps<RootStackParamList, 'Qibla'>;

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'qibla', label: 'Qibla', icon: 'explore' },
  { key: 'quran', label: 'Quran', icon: 'menu-book' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const QiblaScreen: React.FC<QiblaScreenProps> = ({ route, navigation }) => {
  const { location } = route.params;

  const [heading, setHeading] = useState(0);
  const [qiblaDirection, setQiblaDirection] = useState(0);
  const [compassRotation] = useState(new Animated.Value(0));
  const [qiblaRotation, setQiblaRotation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (location) {
      const direction = PrayerTimeCalculator.calculateQiblaDirection(location);
      setQiblaDirection(direction);
    }

    const degree_update_rate = 3;
    CompassHeading.start(degree_update_rate, ({ heading: nextHeading }: { heading: number }) => {
      setHeading(nextHeading);
    });

    return () => {
      CompassHeading.stop();
    };
  }, [location]);

  useEffect(() => {
    const compassAngle = 360 - heading;
    const qiblaAngle = compassAngle + qiblaDirection;

    Animated.timing(compassRotation, {
      toValue: compassAngle,
      duration: 300,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    Animated.timing(qiblaRotation, {
      toValue: qiblaAngle,
      duration: 300,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [heading, qiblaDirection, compassRotation, qiblaRotation]);

  const compassTransform = {
    transform: [{ rotate: compassRotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
  };

  const qiblaTransform = {
    transform: [{ rotate: qiblaRotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerText}>Qibla Direction</Text>
        <View style={styles.compassContainer}>
          <Animated.View style={[styles.compass, compassTransform]}>
            <Image source={require('../assets/images/compass.png')} style={styles.compassImage} />
          </Animated.View>
          <Animated.View style={[styles.qiblaArrow, qiblaTransform]}>
            <Icon name="arrow-up-bold" size={80} color="#38bdf8" />
          </Animated.View>
        </View>
        <Text style={styles.angleText}>{Math.round(qiblaDirection)}° from North</Text>
        <Text style={styles.locationText}>
          {location.city}, {location.country}
        </Text>
      </View>
      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === 'qibla';
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.navItem}
              activeOpacity={0.7}
              onPress={() => {
                if (item.key === 'home') {
                  navigation.navigate('PrayerTime', { location });
                }
              }}
            >
              <Icon name={item.icon} size={24} color={isActive ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 40,
  },
  compassContainer: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compass: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  compassImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  qiblaArrow: {
    position: 'absolute',
  },
  angleText: {
    fontSize: 20,
    color: 'white',
    marginTop: 40,
  },
  locationText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 10,
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
});

export default QiblaScreen;
