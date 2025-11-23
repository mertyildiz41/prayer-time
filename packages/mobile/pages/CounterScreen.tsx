import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from '../i18n';
import { useUmmahStore } from '../store/ummahStore';

type CounterScreenRouteProp = RouteProp<RootStackParamList, 'Counter'>;
type CounterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Counter'>;

const CounterScreen: React.FC = () => {
  const navigation = useNavigation<CounterScreenNavigationProp>();
  const route = useRoute<CounterScreenRouteProp>();
  const { t } = useTranslation();
  const { groupId } = route.params;

  const { selectedGroup, groupCounters, user, updateCounter, fetchGroupDetails } = useUmmahStore();
  const [localCount, setLocalCount] = useState(0);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMessageInput, setShowMessageInput] = useState(false);

  // Get user's current counter from store
  const userCounter = groupCounters.find((c) => c.user_id === user?.id);

  // Load group details on mount
  useEffect(() => {
    if (groupId && (!selectedGroup || selectedGroup.id !== groupId)) {
      fetchGroupDetails(groupId);
    }
  }, [groupId]);

  // Sync local count with user's counter from store
  useEffect(() => {
    if (userCounter) {
      setLocalCount(userCounter.count);
    } else {
      setLocalCount(0);
    }
  }, [userCounter]);

  const handleIncrement = () => {
    setLocalCount((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (localCount > 0) {
      setLocalCount((prev) => prev - 1);
    }
  };

  const handleSend = async () => {
    if (!user) {
      Alert.alert('Error', 'Please initialize your profile first');
      return;
    }

    if (localCount === 0) {
      Alert.alert('Notice', 'Please count at least one before sending.');
      return;
    }

    setIsSending(true);
    try {
      await updateCounter(groupId, localCount, message || undefined);
      navigation.navigate('Completion', { groupId, count: localCount });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send your count');
    } finally {
      setIsSending(false);
    }
  };

  if (!selectedGroup || selectedGroup.id !== groupId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ummah.counter.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>{t('ummah.loading')}</Text>
        </View>
      </View>
    );
  }

  const dhikrPhrase = selectedGroup.dhikr_phrase || t('ummah.counter.defaultDhikr');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectedGroup.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Purpose Card */}
        <View style={styles.purposeCard}>
          <Text style={styles.purposeLabel}>{t('ummah.purpose')}</Text>
          <Text style={styles.purposeText}>{selectedGroup.purpose}</Text>
        </View>

        {/* Dhikr Phrase Display */}
        <View style={styles.dhikrContainer}>
          <Text style={styles.dhikrText}>{dhikrPhrase}</Text>
          {selectedGroup.activity_type !== 'khatm' && (
            <Text style={styles.dhikrSubtext}>{t('ummah.counter.reciteWithIntention')}</Text>
          )}
        </View>

        {/* Counter Display */}
        <View style={styles.counterContainer}>
          <View style={styles.counterCircle}>
            <Text style={styles.counterNumber}>{localCount}</Text>
            <Text style={styles.counterLabel}>{t('ummah.counter.count')}</Text>
          </View>

          {/* Counter Controls */}
          <View style={styles.counterControls}>
            <TouchableOpacity
              style={[styles.counterButton, localCount === 0 && styles.counterButtonDisabled]}
              onPress={handleDecrement}
              disabled={localCount === 0}
            >
              <Icon name="remove" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.counterButton, styles.counterButtonPrimary]}
              onPress={handleIncrement}
              activeOpacity={0.8}
            >
              <Icon name="add" size={40} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message Input (Optional) */}
        <View style={styles.messageSection}>
          <TouchableOpacity
            style={styles.messageToggle}
            onPress={() => setShowMessageInput(!showMessageInput)}
          >
            <Icon
              name={showMessageInput ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color="#38bdf8"
            />
            <Text style={styles.messageToggleText}>
              {showMessageInput
                ? t('ummah.counter.hideMessage')
                : t('ummah.counter.sendIntention')}
            </Text>
          </TouchableOpacity>

          {showMessageInput && (
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder={t('ummah.counter.messagePlaceholder')}
                placeholderTextColor="#64748b"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.messageCharCount}>
                {message.length} / 500
              </Text>
            </View>
          )}
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (localCount === 0 || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={localCount === 0 || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="send" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>
                {t('ummah.counter.sendCount')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: '#0f172a',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  purposeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  purposeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  purposeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dhikrContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  dhikrText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  dhikrSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  counterContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  counterCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1e293b',
    borderWidth: 4,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  counterNumber: {
    fontSize: 64,
    fontWeight: '700',
    color: '#fff',
  },
  counterLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  counterButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonPrimary: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  counterButtonDisabled: {
    opacity: 0.5,
    borderColor: '#64748b',
  },
  messageSection: {
    marginBottom: 24,
  },
  messageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  messageToggleText: {
    fontSize: 16,
    color: '#38bdf8',
    marginLeft: 8,
    fontWeight: '500',
  },
  messageInputContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  messageInput: {
    minHeight: 100,
    fontSize: 16,
    color: '#fff',
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  messageCharCount: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 8,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CounterScreen;

