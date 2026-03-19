import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MicButton({ isListening, onPress }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop;
    if (isListening) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true })
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => loop && loop.stop();
  }, [isListening, pulseAnim]);

  return (
    <View style={styles.container}>
      {isListening && (
        <Animated.View 
          style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], opacity: 0.3 }]} 
        />
      )}
      <TouchableOpacity 
        style={[styles.button, isListening && styles.buttonActive]} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons 
          name={isListening ? "microphone" : "microphone-outline"} 
          size={40} 
          color={isListening ? "#FFFFFF" : "#EAF4FF"} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 2,
  },
  buttonActive: {
    backgroundColor: '#FF4757',
  },
  pulseCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF4757',
    zIndex: 1,
  }
});
