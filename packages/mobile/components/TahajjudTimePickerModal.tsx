// @ts-nocheck

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

const AVAILABLE_TIMES = ['00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30'];

type TahajjudTimePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  selectedTime: string | null;
  formatTime: (time: string) => string;
  title: string;
  description: string;
  cancelLabel: string;
};

const TahajjudTimePickerModal = ({
  visible,
  onClose,
  onSelect,
  selectedTime,
  formatTime,
  title,
  description,
  cancelLabel,
}: TahajjudTimePickerModalProps) => {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <ScrollView
            style={styles.timeList}
            contentContainerStyle={styles.timeListContent}
            showsVerticalScrollIndicator={false}
          >
            {AVAILABLE_TIMES.map((time) => {
              const isActive = time === selectedTime;
              return (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeOption, isActive && styles.timeOptionActive]}
                  activeOpacity={0.85}
                  onPress={() => {
                    onSelect(time);
                    onClose();
                  }}
                >
                  <Text style={[styles.timeOptionLabel, isActive && styles.timeOptionLabelActive]}>
                    {formatTime(time)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.cancelButtonLabel}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    color: '#e0f2fe',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  timeList: {
    maxHeight: 240,
  },
  timeListContent: {
    paddingBottom: 8,
  },
  timeOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  timeOptionActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: 'rgba(56, 189, 248, 0.75)',
  },
  timeOptionLabel: {
    color: '#cbd5f5',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeOptionLabelActive: {
    color: '#0ea5e9',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    alignItems: 'center',
  },
  cancelButtonLabel: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default TahajjudTimePickerModal;
