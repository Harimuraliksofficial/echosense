import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TARGET_NAME_STORAGE_KEY = '@ecosense_target_name';
const LISTEN_URL = "http://10.77.236.194:5000/listen";
const PULSE_DURATION = 4000; // 4 seconds loops for best accuracy

let shouldBeListening = false;
let isPulseActive = false;
let lastBeepTime = 0;

// Callbacks
let onStateChangeCallback = null;
let onMatchCallback = null;
let onTranscriptCallback = null;

export const setNameListenerCallbacks = (onStateChange, onMatch, onTranscript) => {
  onStateChangeCallback = onStateChange;
  onMatchCallback = onMatch;
  onTranscriptCallback = onTranscript;
};

const notifyState = (st) => onStateChangeCallback?.(st);
const notifyLive = (txt) => onTranscriptCallback?.(txt);
const notifyMatch = () => onMatchCallback?.();

const log = (msg) => {
  console.log(`[PulseEngine] ${msg}`);
  notifyLive(msg);
};

// Fuzzy Matching
const checkMatch = (heard, target) => {
  if (!heard || !target) return false;
  const h = heard.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (h.includes(t)) return true;
  
  // Clean punctuation
  const cleanH = h.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  return cleanH.split(' ').some(word => word === t || word.includes(t));
};

const playBeep = async () => {
  if (Date.now() - lastBeepTime < 3000) return;
  lastBeepTime = Date.now();
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/beep.aac'),
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate(s => s.didJustFinish && sound.unloadAsync());
  } catch (e) {}
};

class NameListenerService {
  constructor() {
    this.recording = null;
    this.pulseTimer = null;
  }

  async start() {
    shouldBeListening = true;
    log('Pulse Engine: ACTIVE');
    this._runPulse();
  }

  async stop() {
    shouldBeListening = false;
    isPulseActive = false;
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    if (this.recording) {
      try { await this.recording.stopAndUnloadAsync(); } catch(e) {}
      this.recording = null;
    }
    notifyState('Inactive');
    log('Pulse Engine: STOPPED');
  }

  async _runPulse() {
    if (!shouldBeListening) return;
    
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return log('ERROR: No Mic Access');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      isPulseActive = true;
      notifyState('Sensing...');
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recording = recording;

      // Monitor volume live
      recording.setOnRecordingStatusUpdate((s) => {
        if (s.isRecording) {
            const vol = Math.floor((s.metering || -160) + 160);
            // This updates the UI so user knows it's hearing them
            if (vol > 50) notifyLive(`[Signal: ${vol}] Sensing voice...`);
        }
      });

      this.pulseTimer = setTimeout(() => this._processPulse(recording), PULSE_DURATION);

    } catch (e) {
      log(`Pulse Error: ${e.message}`);
      setTimeout(() => this._runPulse(), 2000);
    }
  }

  async _processPulse(rec) {
    if (!rec) return;
    try {
      notifyState('Analyzing...');
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      this.recording = null;

      if (shouldBeListening) {
         this._runPulse(); // Start NEXT pulse immediately while analyzing previous
      }

      if (!uri) return;

      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: 'audio/m4a',
        name: `pulse.m4a`
      });

      const res = await fetch(LISTEN_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await res.json();
      const heard = data.text || '';

      if (heard.trim()) {
        const saved = await AsyncStorage.getItem(TARGET_NAME_STORAGE_KEY);
        log(`Heard: "${heard}"`);
        if (saved && checkMatch(heard, saved)) {
          log(`🎯 NAME DETECTED! "${saved}"`);
          playBeep();
          notifyMatch();
        }
      }
    } catch (e) {
       console.log('Pulse analysis error:', e);
    }
  }

  async refresh() {
    await this.stop();
    setTimeout(() => this.start(), 500);
  }
}

export const nameListenerService = new NameListenerService();
export default nameListenerService;
