import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
// Picker removed as we are using a custom implementation

import { processSpeech } from '../utils/keywordLogic';
import VisualDisplay from '../components/VisualDisplay';
import MicButton from '../components/MicButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { audioManager } from '../utils/AudioManager';

const BACKEND_URL = "http://10.77.236.194:5000/transcribe";

export default function HomeScreen({ onNavigateToCanvas, onNavigateToFeatureHub, activeNameListener, onTranscriptionStateChange }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [symbols, setSymbols] = useState(null);
  const [recording, setRecording] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const languages = ['English', 'Kannada', 'Malayalam', 'Telugu', 'Tamil', 'Hindi', 'Marathi', 'Gujarati', 'Bengali', 'Spanish'];

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [recording]);

  useEffect(() => {
    let timeoutId;
    if (transcript && transcript !== 'Listening...' && transcript !== 'Transcribing... Please wait.' && !transcript.startsWith('Error:') && !transcript.startsWith('Transcription failed')) {
      timeoutId = setTimeout(() => {
        processText(transcript);
      }, 600); // Wait for the user to finish scrolling the language picker!
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedLanguage]);

  useEffect(() => {
    if (onTranscriptionStateChange) {
      onTranscriptionStateChange(isListening);
    }
  }, [isListening, onTranscriptionStateChange]);

  const processText = async (text) => {
    setSummary('Translating...');
    const result = await processSpeech(text, selectedLanguage);
    setSummary(result.summary);
    setSymbols(result.symbols);
  };

  const startRecording = async () => {
    try {
      // 1. Tell App.js we are recording so it pauses other generic logic if any
      setIsListening(true);
      setTranscript('Preparing microphone...');
      
      // 2. Lock the mic using audioManager to pause the background NameListener
      audioManager.lockMic();
      // Brief delay to ensure the OS releases the mic from the previous recording
      await new Promise(resolve => setTimeout(resolve, 800));

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission is required to use EcoSense.');
        setIsListening(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsListening(true);
      setTranscript('Listening...');
      setSummary('');
      setSymbols(null);
    } catch (err) {
      console.error('Failed to start recording', err);
      setTranscript(`Error: ${err.message}`);
      setIsListening(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      setIsListening(false);
      setTranscript('Transcribing... Please wait.');

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: 'audio/m4a',
        name: 'recording.m4a'
      });

      // Implement an AbortController to prevent indefinite hanging (timeout after 15 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        const result = await response.json();
        
        if (result.error) {
          setTranscript(`Transcription failed: ${result.error}`);
        } else {
          const textToDisplay = result.text || 'No speech detected.';
          setTranscript(textToDisplay);
          if (result.text) {
            await processText(result.text);
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
           setTranscript(`Network Timeout: Server took longer than 15s to respond.`);
        } else {
           setTranscript(`Network Error: Ensure your transcription server is running. (${fetchError.message})`);
        }
      }
      
      // Release mic so the active name listener can resume
      audioManager.releaseMic();
    } catch (err) {
      console.error('Failed to stop recording or transcribe', err);
      setTranscript(`Error: ${err.message}`);
      setIsListening(false);
      audioManager.releaseMic();
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EcoSense</Text>
        <Text style={styles.subtitle}>Assistive Communication</Text>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.transcriptContainer}>
          <ScrollView 
            style={styles.transcriptBox} 
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={[styles.transcriptText, (transcript === 'Listening...' || transcript === 'Transcribing... Please wait.' || !transcript) && styles.placeholderText]}>
              {transcript || 'Tap the microphone and start speaking...'}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryLabel}>SUMMARY</Text>
            
            <TouchableOpacity 
              style={styles.customPickerTrigger}
              onPress={() => setShowLanguageMenu(true)}
            >
              <View style={styles.activePill}>
                <View style={styles.greenDot} />
                <Text style={styles.activePillText}>{selectedLanguage}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={18} color="#888888" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Custom Language Menu Modal */}
          <Modal
            visible={showLanguageMenu}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowLanguageMenu(false)}
          >
            <Pressable 
              style={styles.modalOverlay} 
              onPress={() => setShowLanguageMenu(false)}
            >
              <View style={styles.menuContainer}>
                <Text style={styles.menuTitle}>Select Language</Text>
                <ScrollView bounces={false} style={styles.menuList}>
                  {languages.map((lang) => (
                    <TouchableOpacity 
                      key={lang} 
                      style={[
                        styles.menuItem,
                        selectedLanguage === lang && styles.menuItemActive
                      ]}
                      onPress={() => {
                        setSelectedLanguage(lang);
                        setShowLanguageMenu(false);
                      }}
                    >
                      <Text style={[
                        styles.menuItemText,
                        selectedLanguage === lang && styles.menuItemTextActive
                      ]}>
                        {lang}
                      </Text>
                      {selectedLanguage === lang && (
                         <MaterialCommunityIcons name="check" size={18} color="#10B981" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          <ScrollView style={styles.summaryBox} contentContainerStyle={styles.summaryContent}>
            <Text style={[styles.summaryText, !summary && styles.placeholderText]}>
              {summary || 'Summary will appear here.'}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.visualArea}>
          <VisualDisplay symbols={symbols} />
        </View>
      </View>

      <View style={styles.bottomControls}>
        <View style={styles.sideControlContainer}>
          <TouchableOpacity 
            style={styles.canvasBtn} 
            onPress={onNavigateToCanvas}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pencil-outline" size={28} color="#222222" />
          </TouchableOpacity>
        </View>

        <MicButton isListening={isListening} onPress={handleMicPress} />

        <View style={styles.sideControlContainer}>
          <TouchableOpacity style={styles.proFeaturesBtn} onPress={onNavigateToFeatureHub} activeOpacity={0.7}>
            <MaterialCommunityIcons name="ear-hearing" size={28} color="#222222" />
            <View style={[styles.statusBadge, activeNameListener ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                <Text style={styles.statusBadgeText}>{activeNameListener ? 'ON' : 'OFF'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222222',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  refreshBtn: {
    position: 'absolute',
    right: 20,
    top: 25,
    padding: 4,
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  transcriptContainer: {
    flex: 1.5,
    marginBottom: 20,
  },
  transcriptBox: {
    flex: 1,
    backgroundColor: '#EAF4FF',
    borderRadius: 16,
  },
  transcriptContent: {
    padding: 20,
    paddingBottom: 40,
  },
  transcriptText: {
    fontSize: 24,
    color: '#222222',
    lineHeight: 34,
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999999',
    fontStyle: 'italic',
  },
  summaryContainer: {
    flex: 2.5,
    marginBottom: 20,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 1,
    marginLeft: 4,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 20,
    height: 36,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06501A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32, // Very curvy iPhone style
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuList: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#F8FBF9',
  },
  menuItemText: {
    fontSize: 16,
    color: '#444444',
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#E8F8F5',
    borderRadius: 12,
  },
  summaryContent: {
    padding: 16,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 20,
    color: '#222222',
    fontWeight: '600',
    lineHeight: 28,
  },
  visualArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 0,
  },
  sideControlContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EAF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  proFeaturesBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EAF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#CCCCCC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FAF9F6',
  },
  statusBadgeOn: {
    backgroundColor: '#10B981',
  },
  statusBadgeOff: {
    backgroundColor: '#A0AEC0',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  }
});
