import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './screens/HomeScreen';
import CanvasScreen from './screens/CanvasScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function App() {
  const translateX = useRef(new Animated.Value(0)).current;

  const navigateToCanvas = () => {
    Animated.spring(translateX, {
      toValue: -SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const navigateToHome = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.screenContainer,
            { transform: [{ translateX }] },
          ]}
        >
          {/* Home Screen */}
          <View style={styles.screen}>
            <HomeScreen onNavigateToCanvas={navigateToCanvas} />
          </View>

          {/* Canvas Screen */}
          <View style={styles.screen}>
            <CanvasScreen onNavigateToHome={navigateToHome} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenContainer: {
    flex: 1,
    flexDirection: 'row',
    width: SCREEN_WIDTH * 2,
  },
  screen: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  screen: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});

