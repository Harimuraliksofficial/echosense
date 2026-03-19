import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Voice from '@react-native-voice/voice';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

import { processSpeech } from '../utils/keywordLogic';
import VisualDisplay from '../components/VisualDisplay';
import MicButton from '../components/MicButton';

export default function HomeScreen() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [symbols, setSymbols] = useState(null);
  
  const [useWebFallback, setUseWebFallback] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    // Determine if we need to use the WebView fallback for Expo Go
    const checkVoice = async () => {
      try {
        const isAvailable = await Voice.isAvailable();
        if (!isAvailable && !Voice._voiceManager) {
          setUseWebFallback(true);
        }
      } catch (e) {
        setUseWebFallback(true);
      }
    };
    checkVoice();
    
    // Setup Native Voice if available
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechResults = (e) => {
      if (e.value && e.value.length > 0) {
        const text = e.value[0];
        setTranscript(text);
        processText(text);
      }
    };
    Voice.onSpeechPartialResults = (e) => {
      if (e.value && e.value.length > 0) {
        setTranscript(e.value[0]);
      }
    };
    Voice.onSpeechError = (e) => {
      console.error(e);
      setTranscript(`Native Error: ${e.error?.message || JSON.stringify(e)}`);
      setIsListening(false);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, []);

  const processText = (text) => {
    const result = processSpeech(text);
    setSummary(result.summary);
    setSymbols(result.symbols);
  };

  const handleMicPress = async () => {
    // Request permission first
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Microphone permission is required to use EcoSense.');
      return;
    }

    if (isListening) {
      if (useWebFallback) {
        webViewRef.current?.injectJavaScript(`stopListening(); true;`);
        setIsListening(false);
      } else {
        try { await Voice.stop(); } catch (e) {}
      }
    } else {
      setTranscript('');
      setSummary('');
      setSymbols(null);
      if (useWebFallback) {
        setIsListening(true);
        webViewRef.current?.injectJavaScript(`startListening(); true;`);
      } else {
        try {
          await Voice.start('kn-IN'); 
        } catch (e) {
          console.error(e);
          setTranscript(`Start Error: ${e.message}`);
        }
      }
    }
  };

  const onWebMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'result') {
        setTranscript(data.text);
        processText(data.text);
      } else if (data.type === 'partial') {
        setTranscript(data.text);
      } else if (data.type === 'end') {
        setIsListening(false);
      } else if (data.type === 'start') {
        setIsListening(true);
      } else if (data.type === 'error') {
        setTranscript(`Web Error: ${data.error}`);
        setIsListening(false);
      }
    } catch(e) {}
  };

  const htmlContent = `
    <html>
      <body>
        <script>
          let recognition;
          if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            
            recognition.onstart = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'start'}));
            };
            
            recognition.onresult = function(event) {
              let interim_transcript = '';
              let final_transcript = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                  final_transcript += event.results[i][0].transcript;
                } else {
                  interim_transcript += event.results[i][0].transcript;
                }
              }
              if (final_transcript) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'result', text: final_transcript}));
              } else if (interim_transcript) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'partial', text: interim_transcript}));
              }
            };
            
            recognition.onerror = function(event) {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', error: event.error}));
            };
            
            recognition.onend = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'end'}));
            };
          }
          
          function startListening() {
            if (recognition) recognition.start();
          }
          
          function stopListening() {
            if (recognition) recognition.stop();
          }
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden WebView for Web Speech API fallback on Expo Go */}
      {useWebFallback && (
         <View style={styles.hiddenWebview}>
           <WebView 
             ref={webViewRef}
             source={{ html: htmlContent, baseUrl: 'https://localhost' }} 
             onMessage={onWebMessage}
             mediaPlaybackRequiresUserAction={false}
             allowsInlineMediaPlayback={true}
             javaScriptEnabled={true}
           />
         </View>
      )}
      
      <View style={styles.header}>
        <Text style={styles.title}>EcoSense</Text>
        <Text style={styles.subtitle}>Assistive Communication</Text>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.transcriptContainer}>
          <ScrollView 
            style={styles.transcriptBox} 
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.transcriptText, !transcript && styles.placeholderText]}>
              {transcript || 'Tap the microphone and start speaking...'}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryLabel}>SUMMARY</Text>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryText, !summary && styles.placeholderText]}>
              {summary || 'Summary will appear here.'}
            </Text>
          </View>
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
  hiddenWebview: {
    height: 0, 
    width: 0, 
    opacity: 0, 
    position: 'absolute'
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
    flex: 2,
    marginBottom: 20,
  },
  transcriptBox: {
    flex: 1,
    backgroundColor: '#EAF4FF',
    borderRadius: 16,
    padding: 20,
  },
  transcriptContent: {
    flexGrow: 1,
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
    flex: 1,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#E8F8F5',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 20,
    color: '#222222',
    fontWeight: '600',
    lineHeight: 28,
  },
  visualArea: {
    flex: 1.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  }
});
