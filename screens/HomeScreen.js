import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal, Pressable, TextInput, KeyboardAvoidingView, Keyboard, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { processSpeech, translateOnly } from '../utils/keywordLogic';
import {
  getActiveScenario,
  setActiveScenario,
  clearActiveScenario,
  matchSpokenReply,
  matchWritingScenario,
  getScenarioResponse,
  DEMO_SCENARIOS,
} from '../utils/demoScenarioEngine';
import VisualDisplay from '../components/VisualDisplay';
import MicButton from '../components/MicButton';
import ApiStatusIndicator from '../components/ApiStatusIndicator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BACKEND_BASE_URL } from '../constants/config';

const BACKEND_URL = `${BACKEND_BASE_URL}/transcribe`;

export default function HomeScreen({ onNavigateToCanvas, onNavigateToQuickHelp, onNavigateToHistory }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [symbols, setSymbols] = useState(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const translationCache = useRef({});
  const lastCleanedTextRef = useRef('');
  const activeSessionId = useRef(0);
  const abortControllerRef = useRef(null);

  const isSpecialMessage = (text) => {
    return text === 'Listening...' || text === 'Transcribing... Please wait.' || text === 'Preparing microphone...' || (text && text.startsWith('Error:')) || (text && text.startsWith('Transcription failed'));
  };

  const getDisplayValue = () => {
    if (isSpecialMessage(transcript)) return transcript;
    if (isTranslating) return 'Translating...';
    return translatedText || transcript;
  };

  const displayValue = getDisplayValue();

  const languages = ['English', 'Hindi', 'Kannada', 'Malayalam'];

  useEffect(() => {
    return () => {
      if (audioRecorder.isRecording) {
        audioRecorder.stop().catch(() => {});
      }
    };
  }, [audioRecorder]);

  useEffect(() => {
    let timeoutId;
    if (transcript && !isSpecialMessage(transcript)) {
      timeoutId = setTimeout(() => {
        processText(transcript, selectedLanguage);
      }, 50);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [transcript]);

  const handleLanguageChange = async (newLang) => {
    setSelectedLanguage(newLang);
    setShowLanguageMenu(false);

    if (!transcript || isSpecialMessage(transcript)) {
      return;
    }

    if (newLang === 'English') {
      setTranslatedText('');
      return;
    }

    const textToTranslate = lastCleanedTextRef.current || transcript;
    const cacheKey = `${newLang}_${textToTranslate}`;
    if (translationCache.current[cacheKey]) {
      setTranslatedText(translationCache.current[cacheKey]);
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translateOnly(textToTranslate, newLang);
      translationCache.current[cacheKey] = translated;
      setTranslatedText(translated);
    } catch (err) {
      console.warn("Language switch translation error:", err);
      Alert.alert("Translation Failed", "Could not translate text. Please check connection.");
    } finally {
      setIsTranslating(false);
    }
  };

  const processText = async (text, lang) => {
    // Abort any ongoing process
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentSession = activeSessionId.current;

    // ── Predefined Demo Scenario Check (Section 3 & 4) ──────────────────────
    const activeId = getActiveScenario();
    const matchedReplyScenario = matchSpokenReply(text, activeId);

    if (matchedReplyScenario) {
      const demoResult = getScenarioResponse(matchedReplyScenario, lang);
      lastCleanedTextRef.current = demoResult.cleanedText;

      // Populate language cache for instant 0ms switching across all supported languages
      translationCache.current[`English_${demoResult.cleanedText}`] = matchedReplyScenario.reply.en;
      translationCache.current[`Hindi_${demoResult.cleanedText}`] = matchedReplyScenario.reply.hi;
      translationCache.current[`Kannada_${demoResult.cleanedText}`] = matchedReplyScenario.reply.kn;
      translationCache.current[`Malayalam_${demoResult.cleanedText}`] = matchedReplyScenario.reply.ml;
      translationCache.current[`English_${text}`] = matchedReplyScenario.reply.en;
      translationCache.current[`Hindi_${text}`] = matchedReplyScenario.reply.hi;
      translationCache.current[`Kannada_${text}`] = matchedReplyScenario.reply.kn;
      translationCache.current[`Malayalam_${text}`] = matchedReplyScenario.reply.ml;

      setTranslatedText(demoResult.summary);
      setSymbols([...demoResult.symbols]);
      setIsTranslating(false);

      // Save history in background
      const finalMsg = demoResult.summary;
      const kwString = demoResult.symbols.map(s => s.label || s.keyword).join(', ');
      fetch(`${BACKEND_BASE_URL}/api/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMsg, keywords: kwString })
      }).catch(e => console.warn('History save failed', e));

      return;
    }

    // Check if user is typing a written scenario question (Scenario 3 or 4)
    const matchedWriting = matchWritingScenario(text);
    if (matchedWriting) {
      setActiveScenario(matchedWriting.id);
    }
    
    if (lang !== 'English') {
      const cacheKey = `${lang}_${text}`;
      if (translationCache.current[cacheKey]) {
        setTranslatedText(translationCache.current[cacheKey]);
        return;
      }
      setIsTranslating(true);
    } else {
      setTranslatedText('');
    }
    try {
      const result = await processSpeech(text, lang, currentSession, abortControllerRef.current.signal);
      
      // Discard if session changed
      if (currentSession !== activeSessionId.current) return;

      lastCleanedTextRef.current = result.cleanedText || text;

      if (lang !== 'English') {
        if (result.summary && result.summary.startsWith('[Translation Error]')) {
           setTranslatedText('');
           Alert.alert("Translation Failed", "Could not connect to the translation model. Falling back to English.");
        } else {
           const cacheKey = `${lang}_${text}`;
           translationCache.current[cacheKey] = result.summary;
           setTranslatedText(result.summary);
        }
      }
      setSymbols(result.symbols);

      // Save history in background
      const finalMsg = lang === 'English' ? text : result.summary;
      const kwString = result.symbols ? result.symbols.join(', ') : '';
      if (finalMsg && !finalMsg.startsWith('[Translation Error]')) {
        fetch(`${BACKEND_BASE_URL}/api/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: finalMsg, keywords: kwString })
        }).catch(e => console.warn('History save failed', e));
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("processText aborted");
        return;
      }
      console.warn("processText error:", err);
      if (currentSession !== activeSessionId.current) return;
      if (lang !== 'English') {
        setTranslatedText('');
        Alert.alert("Translation Failed", "An error occurred during translation. Falling back to English.");
      }
    } finally {
      if (currentSession === activeSessionId.current) {
        setIsTranslating(false);
      }
    }
  };

  const startRecording = async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      activeSessionId.current += 1;
      
      setIsListening(true);
      setTranscript('Preparing microphone...');
      
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission is required to use EcoSense.');
        setIsListening(false);
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      
      setIsListening(true);
      setTranscript('Listening...');
      setTranslatedText('');
      setSymbols(null);
      setIsTranslating(false);
      
      try {
        await fetch(`${BACKEND_BASE_URL}/api/cancel-session`, { method: 'POST' });
        await fetch(`${BACKEND_BASE_URL}/api/clear-history`, { method: 'POST' });
      } catch (e) {
        console.warn("Failed to reset backend state", e);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      setTranscript(`Error: ${err.message}`);
      setIsListening(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!audioRecorder.isRecording) return;

      setIsListening(false);
      setTranscript('Transcribing... Please wait.');

      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        setTranscript('No recording found.');
        return;
      }

      try {
        const uploadResult = await FileSystem.uploadAsync(BACKEND_URL, uri, {
          fieldName: 'audio',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          mimeType: 'audio/m4a',
        });

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          const result = JSON.parse(uploadResult.body);
          if (result.error) {
            setTranscript(`Transcription failed: ${result.error}`);
          } else {
            const textToDisplay = result.text || 'No speech detected.';
            setTranscript(textToDisplay);
          }
        } else {
          setTranscript(`Server Error (${uploadResult.status}): ${uploadResult.body}`);
        }
      } catch (fetchError) {
        setTranscript(`Network Error: Ensure your transcription server is running. (${fetchError.message})`);
      }
    } catch (err) {
      console.error('Failed to stop recording or transcribe', err);
      setTranscript(`Error: ${err.message}`);
      setIsListening(false);
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
        <View style={styles.topRightControls}>
          <TouchableOpacity onPress={onNavigateToHistory} style={styles.historyBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="history" size={26} color="#666" />
          </TouchableOpacity>
          <ApiStatusIndicator />
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.transcriptContainer}>
          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
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
            <TextInput
              style={[styles.transcriptInput, (isSpecialMessage(displayValue) || !displayValue) && styles.placeholderText]}
              multiline
              placeholder="Tap the microphone or start typing..."
              placeholderTextColor="#999999"
              value={displayValue}
              onChangeText={(text) => {
                 if (selectedLanguage === 'English') {
                   setTranscript(text);
                   setTranslatedText('');
                 }
              }}
              editable={!isTranslating && !isSpecialMessage(displayValue) && selectedLanguage === 'English'}
              textAlignVertical="top"
            />
          </View>
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
                      handleLanguageChange(lang);
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

        <View style={styles.visualArea}>
          <View style={styles.visualHeaderRow}>
            <Text style={styles.summaryLabel}>VISUAL COMMUNICATION</Text>
          </View>
          <VisualDisplay transcript={transcript} keywords={symbols} />
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
          <TouchableOpacity style={styles.proFeaturesBtn} onPress={onNavigateToQuickHelp} activeOpacity={0.7}>
            <MaterialCommunityIcons name="hand-heart" size={28} color="#D4726A" />
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
  topRightControls: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -14 }],
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyBtn: {
    marginRight: 12,
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
  mainContent: {
    flex: 1,
    padding: 20,
  },
  transcriptContainer: {
    flex: 1,
    marginBottom: 15,
  },
  transcriptBox: {
    flex: 1,
    backgroundColor: '#EAF4FF',
    borderRadius: 16,
    padding: 16,
  },
  transcriptHeader: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  transcriptInput: {
    flex: 1,
    fontSize: 24,
    color: '#222222',
    lineHeight: 34,
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999999',
    fontStyle: 'italic',
  },
  visualHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 1,
    marginLeft: 4,
    textTransform: 'uppercase',
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
    borderRadius: 32,
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
  visualArea: {
    flex: 1.5,
    backgroundColor: '#E8F8F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8F8F5',
    padding: 16,
    marginBottom: 10,
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
  }
});
