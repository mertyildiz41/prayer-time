import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from '../i18n';

type CompletionScreenRouteProp = RouteProp<RootStackParamList, 'Completion'>;
type CompletionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Completion'>;

const CompletionScreen: React.FC = () => {
  const navigation = useNavigation<CompletionScreenNavigationProp>();
  const route = useRoute<CompletionScreenRouteProp>();
  const { t } = useTranslation();
  const { groupId, count } = route.params;

  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Success animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleReturnToGroup = () => {
    navigation.navigate('GroupDetail', { groupId });
  };

  const handleGoHome = () => {
    navigation.navigate('Ummah');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={styles.iconCircle}>
            <Icon name="check-circle" size={120} color="#38bdf8" />
          </View>
        </Animated.View>

        {/* Success Message */}
        <Animated.View
          style={[
            styles.messageContainer,
            {
              opacity: opacityAnim,
            },
          ]}
        >
          <Text style={styles.successTitle}>{t('ummah.completion.success')}</Text>
          <Text style={styles.successMessage}>
            {t('ummah.completion.message')}
          </Text>
          
          {count && count > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {count.toLocaleString()} {t('ummah.completion.recitations')}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          style={[
            styles.actionsContainer,
            {
              opacity: opacityAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleReturnToGroup}
            activeOpacity={0.8}
          >
            <Icon name="group" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {t('ummah.completion.returnToGroup')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGoHome}
            activeOpacity={0.8}
          >
            <Icon name="home" size={24} color="#38bdf8" />
            <Text style={styles.secondaryButtonText}>
              {t('ummah.completion.goHome')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: 100,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#38bdf8',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 24,
  },
  countBadge: {
    backgroundColor: '#38bdf8',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  countText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  actionsContainer: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#38bdf8',
  },
});

export default CompletionScreen;

