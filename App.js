import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, StatusBar, Text, TouchableOpacity, Modal, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

// Suppress known harmless deprecation warnings
LogBox.ignoreLogs([
  '[expo-av]',
  'setLayoutAnimationEnabledExperimental',
]);
import { useNameListener } from './hooks/useNameListener';
import HomeScreen from './screens/HomeScreen';
import CanvasScreen from './screens/CanvasScreen';
import FeatureHubScreen from './screens/FeatureHubScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function App() {
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  const [activeNameListener, setActiveNameListener] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const [targetName, setTargetName] = useState('Hari');
  
  const {
    startListening,
    stopListening,
    refreshListener,
    listenerState,
    latestTranscript,
    matchStatus,
    lastTriggerTime,
    isListening,
  } = useNameListener(targetName);

  useEffect(() => {
    const loadState = async () => {
      try {
        const savedName = await AsyncStorage.getItem('@ecosense_targetname');
        if (savedName) setTargetName(savedName);

        const saved = await AsyncStorage.getItem('@ecosense_namelistener');
        if (saved !== null) {
            const isActive = JSON.parse(saved);
            setActiveNameListener(isActive);
            if (isActive) {
               // Must be done in next tick to avoid calling start logic before hook is fully ready
               setTimeout(startListening, 500);
            }
        }
      } catch (e) {
        console.log("Error loading name listener state", e);
      }
    };
    loadState();
  }, []);

  const handleToggleNameListener = async (val) => {
    setActiveNameListener(val);
    try {
      await AsyncStorage.setItem('@ecosense_namelistener', JSON.stringify(val));
    } catch (e) {}
    if (val) startListening();
    else stopListening();
  };

  const handleSaveName = async (newName) => {
    setTargetName(newName);
    try {
      if (newName) {
        await AsyncStorage.setItem('@ecosense_targetname', newName);
      } else {
        await AsyncStorage.removeItem('@ecosense_targetname');
      }
    } catch (e) {}
  };

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

  const navigateToFeatureHub = () => {
    Animated.spring(translateX, {
      toValue: -SCREEN_WIDTH * 2, // Slide left to view Feature Hub (index 2)
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
               onNavigateToFeatureHub={navigateToFeatureHub}
               activeNameListener={activeNameListener}
               onTranscriptionStateChange={setIsTranscribing}
             />
          </View>

          {/* Feature Hub Screen */}
          <View style={styles.screen}>
            <FeatureHubScreen 
               onNavigateToHome={navigateToHome} 
               activeNameListener={activeNameListener}
               onToggleNameListener={handleToggleNameListener}
               targetName={targetName}
               onSaveName={handleSaveName}
               latestTranscript={latestTranscript}
               listenerState={listenerState}
               matchStatus={matchStatus}
               lastTriggerTime={lastTriggerTime}
               isListening={isListening}
               onRefreshListener={refreshListener}
            />
          </View>
        </Animated.View>

        {/* Global Listener Indicator (Top) */}
        {activeNameListener && listenerState !== 'Inactive' && listenerState !== 'Paused' && (
          <View style={styles.listenerIndicator}>
            <Text style={styles.listenerIndicatorText}>{listenerState}</Text>
          </View>
        )}

        {/* Global Match Alert (Center) removed for full screen debug panel */}
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
  },
  listenerIndicator: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 9000,
    elevation: 9000
  },
  listenerIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#D32F2F',
    textAlign: 'center',
  },
  alertDesc: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#444444'
  },
  alertBtn: {
    backgroundColor: '#ECFDF5',
    padding: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  alertBtnText: {
    color: '#06501A',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

