import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Suppress known harmless deprecation warnings
LogBox.ignoreLogs([
  '[expo-av]',
  'setLayoutAnimationEnabledExperimental',
]);

import HomeScreen from './screens/HomeScreen';
import CanvasScreen from './screens/CanvasScreen';
import QuickHelpScreen from './screens/QuickHelpScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function App() {
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  const navigateToCanvas = () => {
    Animated.spring(translateX, {
      toValue: 0, // Slide right to view Canvas (index 0)
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const navigateToHome = () => {
    Animated.spring(translateX, {
      toValue: -SCREEN_WIDTH, // Center screen
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const navigateToQuickHelp = () => {
    Animated.spring(translateX, {
      toValue: -SCREEN_WIDTH * 2, // Slide left to view Quick Help (index 2)
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
          {/* Canvas Screen */}
          <View style={styles.screen}>
            <CanvasScreen onNavigateToHome={navigateToHome} />
          </View>

          {/* Home Screen */}
          <View style={styles.screen}>
             <HomeScreen 
               onNavigateToCanvas={navigateToCanvas} 
               onNavigateToQuickHelp={navigateToQuickHelp}
             />
          </View>

          {/* Quick Help Screen */}
          <View style={styles.screen}>
            <QuickHelpScreen 
               onNavigateToHome={navigateToHome} 
            />
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
    width: SCREEN_WIDTH * 3,
  },
  screen: {
    width: SCREEN_WIDTH,
    flex: 1,
  }
});

