import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Picker } from '@react-native-picker/picker';

import { processSpeech } from '../utils/keywordLogic';
import VisualDisplay from '../components/VisualDisplay';
import MicButton from '../components/MicButton';

const BACKEND_URL = "http://10.110.139.194:5000/transcribe";

export default function HomeScreen() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [symbols, setSymbols] = useState(null);
  const [recording, setRecording] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

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

  const processText = async (text) => {
    setSummary('Translating...');
    const result = await processSpeech(text, selectedLanguage);
    setSummary(result.summary);
    setSymbols(result.symbols);
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission is required to use EcoSense.');
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

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

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
            <Text style={styles.summaryLabel}>SUMMARY ({selectedLanguage.toUpperCase()})</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedLanguage}
                style={styles.picker}
                onValueChange={(itemValue) => setSelectedLanguage(itemValue)}
              >
                {['English', 'Kannada', 'Malayalam', 'Telugu', 'Tamil', 'Hindi', 'Marathi', 'Gujarati', 'Bengali', 'Spanish'].map(lang => (
                  <Picker.Item key={lang} label={lang} value={lang} />
                ))}
              </Picker>
            </View>
          </View>
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

      <MicButton isListening={isListening} onPress={handleMicPress} />
      
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
  pickerContainer: {
    width: 140,
    height: 36,
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    width: 140,
    height: 36,
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
  }
});
