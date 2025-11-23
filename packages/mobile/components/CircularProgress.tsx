import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Try to import react-native-svg safely, but default to false
// The "Unimplemented component" error means native module isn't linked
let useSvg = false;

// For now, always use fallback to avoid native module errors
// Once react-native-svg is properly linked (pod install + rebuild), set this to true
const ENABLE_SVG = false;

interface CircularProgressProps {
  current: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  current,
  total,
  size = 200,
  strokeWidth = 12,
  color = '#38bdf8',
  backgroundColor = '#1e293b',
}) => {
  const progress = Math.min((current / total) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  // Always use fallback for now to avoid native module errors
  // Simple circular progress using View components with borders
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer background circle */}
      <View
        style={[
          styles.fallbackOuter,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          },
        ]}
      />
      
      {/* Progress indicator - shows progress as a filled circle */}
      {progress > 0 && (
        <View
          style={[
            styles.fallbackProgressContainer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
            },
          ]}
        >
          {/* Progress fill using conic-like gradient simulation */}
          <View
            style={[
              styles.fallbackProgressArc,
              {
                width: size - strokeWidth * 2,
                height: size - strokeWidth * 2,
                borderRadius: (size - strokeWidth * 2) / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderTopColor: progress > 0 ? color : backgroundColor,
                borderRightColor: progress > 25 ? color : backgroundColor,
                borderBottomColor: progress > 50 ? color : backgroundColor,
                borderLeftColor: progress > 75 ? color : backgroundColor,
                top: strokeWidth,
                left: strokeWidth,
                transform: [{ rotate: '-90deg' }],
              },
            ]}
          />
        </View>
      )}
      
      {/* Inner circle to create ring effect */}
      <View
        style={[
          styles.fallbackInner,
          {
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
            borderRadius: (size - strokeWidth * 2) / 2,
            backgroundColor: '#0f172a',
            top: strokeWidth,
            left: strokeWidth,
          },
        ]}
      />
      
      {/* Text content */}
      <View style={styles.content}>
        <Text style={styles.countText}>
          {current.toLocaleString()} / {total.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  content: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  countText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  fallbackOuter: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  fallbackProgressContainer: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackProgressArc: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  fallbackInner: {
    position: 'absolute',
  },
});

export default CircularProgress;

