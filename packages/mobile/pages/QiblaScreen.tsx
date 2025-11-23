// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, TouchableOpacity } from 'react-native';
import CompassHeading from 'react-native-compass-heading';
import { PrayerTimeCalculator } from '@prayer-time/shared';
import Icon from '@react-native-vector-icons/material-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

import { useTranslation } from '../i18n';

type QiblaScreenProps = NativeStackScreenProps<RootStackParamList, 'Qibla'>;

const QiblaScreen: React.FC<QiblaScreenProps> = ({ route, navigation }) => {
  const { location } = route.params;
  const { t } = useTranslation();

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
    <View style={styles.safeArea}>
      <View style={styles.container}>
  <Text style={styles.headerText}>{t('qibla.title')}</Text>
        <View style={styles.compassContainer}>
          <Animated.View style={[styles.compass, compassTransform]}>
            <Image source={require('../assets/images/compass.png')} style={styles.compassImage} />
          </Animated.View>
          <Animated.View style={[styles.qiblaArrow, qiblaTransform]}>
            <Icon name="arrow-upward" size={80} color="#38bdf8" />
          </Animated.View>
        </View>
  <Text style={styles.angleText}>{t('qibla.angle', { angle: Math.round(qiblaDirection) })}</Text>
        <Text style={styles.locationText}>
          {location.city}, {location.country}
        </Text>
        <TouchableOpacity
          style={styles.findMosqueButton}
          onPress={() => navigation.navigate('MosqueFinder')}
          activeOpacity={0.8}
        >
          <Icon name="place" size={20} color="#22c55e" />
          <Text style={styles.findMosqueButtonText}>{t('qibla.findMosques')}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  findMosqueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 32,
    gap: 8,
  },
  findMosqueButtonText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QiblaScreen;
