import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { request, requestNotifications, PERMISSIONS, RESULTS } from 'react-native-permissions';

const OnboardingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const goToNotificationStep = () => setCurrentStep(1);

  const handleAllowLocation = async () => {
    try {
      const permission = Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      
      const result = await request(permission);
      
      if (result === RESULTS.GRANTED) {
          console.log('Location permission granted');
      } else {
          console.log('Location permission denied');
      }
    } catch (error) {
        console.error("Failed to request location permission", error);
    } finally {
        goToNotificationStep();
    }
  };

  const handleEnableNotifications = async () => {
    try {
      let result;
      if (Platform.OS === 'ios') {
        const { status } = await requestNotifications(['alert', 'badge', 'sound']);
        result = status;
      } else { // Android
        result = await request('android.permission.POST_NOTIFICATIONS' as any);
      }

      onComplete();
      if (result === RESULTS.GRANTED) {
          console.log('Notification permission granted');
      } else {
          console.log('Notification permission denied');
      }
    } catch (error) {
        console.error("Failed to request notification permission", error);
    }
  };

  const renderPagination = () => (
    <View style={styles.pagination}>
      <View style={[styles.dot, currentStep === 0 && styles.activeDot]} />
      <View style={[styles.dot, currentStep === 1 && styles.activeDot]} />
    </View>
  );

  const renderLocationStep = () => (
    <View style={styles.slide}>
      <View style={styles.content}>
        <Image source={require('../assets/images/location-icon.png')} style={styles.icon} />
        <Text style={styles.title}>Accurate Prayer Times</Text>
        <Text style={styles.description}>
          To provide precise prayer schedules and Qibla direction, please allow location access. Your data is kept private.
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleAllowLocation}>
          <Text style={styles.buttonText}>Allow</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNotificationStep}>
          <Text style={styles.linkText}>Deny</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotificationStep = () => (
    <View style={styles.slide}>
      <View style={styles.content}>
        <Image source={require('../assets/images/notification-icon.png')} style={styles.icon} />
        <Text style={styles.title}>Never Miss a Prayer</Text>
        <Text style={styles.description}>
          Enable notifications to receive timely alerts for daily prayer times, helping you stay connected to your faith.
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleEnableNotifications}>
          <Text style={styles.buttonText}>Enable Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onComplete}>
          <Text style={styles.linkText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {currentStep === 0 ? renderLocationStep() : renderNotificationStep()}
      {renderPagination()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#0a0e1a',
    paddingBottom: 150, // Add padding to the bottom
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 120,
    height: 120,
    marginBottom: 40,
  },
  placeholderIcon: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1e293b',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 25,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 3,
    marginRight: 3,
    marginTop: 3,
    marginBottom: 3,
  },
  activeDot: {
    backgroundColor: '#3b82f6',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 3,
    marginRight: 3,
    marginTop: 3,
    marginBottom: 3,
  },
});

export default OnboardingScreen;
