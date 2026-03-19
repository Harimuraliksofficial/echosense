import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function VisualDisplay({ symbols }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (symbols) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [symbols, fadeAnim]);

  if (!symbols) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholderEmoji}>🗣️</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.symbolsStyle}>{symbols}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderEmoji: {
    fontSize: 80,
    opacity: 0.1,
  },
  symbolsStyle: {
    fontSize: 80,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  }
});
