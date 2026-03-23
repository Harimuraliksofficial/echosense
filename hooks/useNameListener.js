import { useState, useEffect, useRef } from 'react';
import Voice from '@react-native-voice/voice';
import { Audio } from 'expo-av';
import { Vibration } from 'react-native';
import { audioManager } from '../utils/AudioManager';

export function useNameListener(targetName = 'Hari') {
  const [isListening, setIsListening] = useState(false);
  const [listenerState, setListenerState] = useState('Idle');
  const [latestTranscript, setLatestTranscript] = useState('');
  const [lastTriggerTime, setLastTriggerTime] = useState('None');
  const [matchStatus, setMatchStatus] = useState('');

  const isSessionTriggered = useRef(false);
  const shouldBeListening = useRef(false);
  const isComponentMounted = useRef(false);
  const lastBeepTime = useRef(0);
  const voiceTimeout = useRef(null);

  const isListeningRef = useRef(false);
  const listenerStateRef = useRef('Idle');
  const stateTimestamp = useRef(Date.now());

  const updateIsListening = (val) => {
    isListeningRef.current = val;
    setIsListening(val);
  };

  const updateListenerState = (val) => {
    listenerStateRef.current = val;
    setListenerState(val);
    stateTimestamp.current = Date.now();
  };

  // Dynamic phrase generation
  const phrasesRef = useRef({ wake: [], single: [] });

  useEffect(() => {
    const getVariants = (name) => {
      const n = name.toLowerCase().trim();
      const vars = [n];
      if (n === 'jarvis') vars.push('travis', 'marvis', 'charvis', 'tarvis', 'service', 'jarves', 'jarvas');
      if (n === 'hari') vars.push('harry', 'hurry', 'hairy', 'harri', 'haari', 'ari', 'hadi');
      return [...new Set(vars)];
    };

    const variants = getVariants(targetName);
    const wake = [
      'hello', 'helo', 'hallow', 'yellow', 'hey', 'hi ',
      ...variants.flatMap(v => [`hello ${v}`, `hey ${v}`, `hi ${v}`])
    ];

    phrasesRef.current = { wake, single: variants };
  }, [targetName]);

  const accumulatedText = useRef('');

  useEffect(() => {
    isComponentMounted.current = true;

    Voice.onSpeechStart = () => {
      if (isComponentMounted.current) {
        updateListenerState('Listening');
        updateIsListening(true);
      }
    };

    Voice.onSpeechVolumeChanged = () => {};

    Voice.onSpeechEnd = () => {
      if (isComponentMounted.current) {
        updateIsListening(false);
        // Do NOT flash "Restarting" — keep showing "Listening" during seamless restart
      }
      if (shouldBeListening.current && audioManager.canUseMic()) {
        setTimeout(() => {
          if (shouldBeListening.current && !isListeningRef.current) {
            startVoiceEngine();
          }
        }, 500);
      }
    };

    Voice.onSpeechError = (e) => {
      const errorCode = String(e.error?.code || e.error?.message?.split('/')[0] || '');

      // Routine timeouts (5, 6, 7) — completely silent
      if (['5', '6', '7'].includes(errorCode)) {
        // No-op: normal background behavior
      } else if (isComponentMounted.current) {
        updateListenerState('Error');
      }

      if (shouldBeListening.current && audioManager.canUseMic()) {
        if (['11', '10', '8'].includes(errorCode)) {
          restartListening(10000);
        } else {
          restartListening(2000);
        }
      }
    };

    Voice.onSpeechResults = (e) => {
      if (e.value && e.value.length > 0) {
        for (const text of e.value) {
          if (checkDetection(text, true)) break;
        }
        accumulatedText.current = '';
      }
    };

    Voice.onSpeechPartialResults = (e) => {
      if (e.value && e.value.length > 0) {
        setLatestTranscript(e.value[0]);
        accumulatedText.current = e.value[0];
        for (const text of e.value) {
          if (checkDetection(text, false)) break;
        }
      }
    };

    const unsubscribe = audioManager.subscribe((isLocked) => {
      if (isLocked) {
        stopVoiceEngine();
        if (isComponentMounted.current) {
          updateListenerState('Paused');
        }
      } else {
        if (shouldBeListening.current) {
          startVoiceEngine();
        } else {
          if (isComponentMounted.current) updateListenerState('Idle');
        }
      }
    });

    return () => {
      isComponentMounted.current = false;
      Voice.destroy().then(Voice.removeAllListeners);
      clearTimeout(voiceTimeout.current);
      unsubscribe();
    };
  }, []);

  // Watchdog: Heal from stuck states (runs every 5s to reduce restart cycling)
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (!shouldBeListening.current) return;
      if (!audioManager.canUseMic()) return;

      const currentIsListening = isListeningRef.current;
      const currentState = listenerStateRef.current;
      const timeInState = Date.now() - stateTimestamp.current;

      // Only heal if genuinely stuck for > 6 seconds
      if (!currentIsListening && (currentState === 'Idle' || currentState === 'Inactive')) {
        if (timeInState > 3000) startVoiceEngine();
      }

      if (currentState === 'Error' || currentState === 'Starting...') {
        if (timeInState > 6000) {
          stopVoiceEngine().then(() => startVoiceEngine());
        }
      }
    }, 5000);
    return () => clearInterval(watchdog);
  }, []);

  const checkDetection = (text, isFinal = false) => {
    if (!shouldBeListening.current || !audioManager.canUseMic()) return false;
    if (!text || text.trim().length < 2) return false;

    const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!normalized) return false;

    // Strategy 1: "Hello" or variants at start
    const hasTrigger = phrasesRef.current.wake.some(v =>
      normalized.startsWith(v) || normalized.split(/\s+/)[0] === v.trim()
    );

    if (hasTrigger) {
      handleDetection(normalized);
      return true;
    }

    // Strategy 2 (Final only): Solo name match for close range
    if (isFinal) {
      const soloMatch = phrasesRef.current.single.some(kw => normalized.includes(kw));
      if (soloMatch) {
        handleDetection(normalized);
        return true;
      }
    }

    return false;
  };

  const handleDetection = async (text) => {
    const now = Date.now();
    // 5 second cooldown to prevent double-beeping
    if (now - lastBeepTime.current < 5000) return;
    lastBeepTime.current = now;

    setMatchStatus('Detected!');
    setLastTriggerTime(new Date().toLocaleTimeString());

    setTimeout(() => {
      if (isComponentMounted.current) setMatchStatus('');
    }, 4000);

    // Vibration
    try { Vibration.vibrate(200); } catch (e) {}

    // Beep
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/beep.aac'),
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {}
  };

  const startVoiceEngine = async () => {
    if (isListeningRef.current || !isComponentMounted.current) return;
    if (!audioManager.canUseMic()) {
      updateListenerState('Paused');
      return;
    }

    try {
      isSessionTriggered.current = false;
      updateIsListening(true);
      updateListenerState('Starting...');
      await Voice.start('en-US', {
        EXTRA_PARTIAL_RESULTS: true,
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 10000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 10000,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 15000,
      });
      updateListenerState('Listening');
    } catch (e) {
      updateListenerState('Error');
      restartListening(3000);
    }
  };

  const stopVoiceEngine = async () => {
    try {
      updateIsListening(false);
      await Voice.cancel();
      await Voice.destroy();
    } catch (e) {}
  };

  const restartListening = (delay = 2000) => {
    if (voiceTimeout.current) clearTimeout(voiceTimeout.current);
    // Do NOT flash "Restarting" — keep current state
    voiceTimeout.current = setTimeout(async () => {
      if (shouldBeListening.current && audioManager.canUseMic()) {
        await stopVoiceEngine();
        setTimeout(startVoiceEngine, 500);
      }
    }, delay);
  };

  const startListening = () => {
    shouldBeListening.current = true;
    if (audioManager.canUseMic()) {
      startVoiceEngine();
    } else {
      updateListenerState('Paused');
    }
  };

  const stopListening = () => {
    shouldBeListening.current = false;
    clearTimeout(voiceTimeout.current);
    stopVoiceEngine();
    updateListenerState('Idle');
  };

  const refreshListener = () => {
    if (!shouldBeListening.current) return;
    stopVoiceEngine().then(() => {
      setTimeout(() => {
        if (shouldBeListening.current && audioManager.canUseMic()) {
          startVoiceEngine();
        }
      }, 500);
    });
  };

  return {
    startListening,
    stopListening,
    refreshListener,
    isListening,
    listenerState,
    latestTranscript,
    matchStatus,
    lastTriggerTime,
  };
}
