import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

type ToggleSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  activeThumbColor?: string;
  inactiveThumbColor?: string;
};

const ToggleSwitch = ({
  value,
  onValueChange,
  disabled = false,
  activeColor = '#3b82f6',
  inactiveColor = '#1f2937',
  activeThumbColor = '#93c5fd',
  inactiveThumbColor = '#e5e7eb',
}: ToggleSwitchProps) => {
  const thumbColor = value ? activeThumbColor : inactiveThumbColor;

  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      activeOpacity={0.85}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? activeColor : inactiveColor },
        value ? styles.trackEnabled : styles.trackDisabled,
        disabled && styles.trackInactive,
      ]}
    >
      <View
        style={[
          styles.thumb,
          value ? styles.thumbEnabled : styles.thumbDisabled,
          { backgroundColor: thumbColor },
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    flexShrink: 0,
  },
  trackEnabled: {
    alignItems: 'flex-end',
  },
  trackDisabled: {
    alignItems: 'flex-start',
  },
  trackInactive: {
    opacity: 0.55,
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  thumbEnabled: {
    shadowColor: '#2563eb',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbDisabled: {
    shadowColor: '#020617',
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});

export default ToggleSwitch;
