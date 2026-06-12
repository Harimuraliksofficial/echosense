/**
 * ApiStatusIndicator.js
 *
 * Displays a green or red status dot in the top-right corner of the app header
 * indicating whether the local Ollama server (with mistral:latest) is reachable.
 *
 * Green dot: Ollama running + mistral:latest available + valid response.
 * Red dot  : Server down, model missing, or request failed.
 *
 * Health check endpoint: GET <BACKEND_BASE_URL>/api/health
 * Poll interval: every 30 seconds.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { BACKEND_BASE_URL } from '../constants/config';

const HEALTH_ENDPOINT = `${BACKEND_BASE_URL}/api/health`;
const POLL_INTERVAL_MS = 30_000; // 30 seconds

export default function ApiStatusIndicator() {
  const [status, setStatus] = useState('unknown'); // 'ok' | 'error' | 'unknown'
  const [details, setDetails] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef(null);

  // Pulse animation for the green dot
  const startPulse = () => {
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();
  };

  const stopPulse = () => {
    if (pulseRef.current) pulseRef.current.stop();
    pulseAnim.setValue(1);
  };

  const checkHealth = async () => {
    try {
      const response = await fetch(HEALTH_ENDPOINT, { method: 'GET' });
      const data = await response.json();

      if (response.ok && data.status === 'ok' && data.model_available === true) {
        setStatus('ok');
        setDetails({
          message: 'Ollama is running',
          model: data.model || 'mistral:latest',
          models: data.models || [],
        });
      } else {
        setStatus('error');
        setDetails({
          message: data.message || `HTTP ${response.status}`,
          model_available: data.model_available ?? false,
        });
      }
    } catch (err) {
      setStatus('error');
      setDetails({ message: `Cannot reach backend: ${err.message}` });
    }
  };

  useEffect(() => {
    // Initial check
    checkHealth();

    // Recurring poll
    const interval = setInterval(checkHealth, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Manage pulse based on status
  useEffect(() => {
    if (status === 'ok') {
      startPulse();
    } else {
      stopPulse();
    }
    return () => stopPulse();
  }, [status]);

  const dotColor = status === 'ok' ? '#22C55E' : status === 'error' ? '#EF4444' : '#9CA3AF';

  return (
    <>
      <TouchableOpacity
        style={styles.wrapper}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
        accessibilityLabel={`API Status: ${status}`}
      >
        {/* Pulse ring (green only) */}
        {status === 'ok' && (
          <Animated.View
            style={[
              styles.pulseRing,
              { backgroundColor: dotColor + '40', transform: [{ scale: pulseAnim }] },
            ]}
          />
        )}
        {/* Solid dot */}
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.dotLarge, { backgroundColor: dotColor }]} />
              <Text style={styles.cardTitle}>
                {status === 'ok' ? 'Ollama Online' : status === 'error' ? 'Ollama Offline' : 'Checking…'}
              </Text>
            </View>

            <View style={styles.divider} />

            {details ? (
              <>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{details.message}</Text>

                {details.model && (
                  <>
                    <Text style={styles.detailLabel}>Active Model</Text>
                    <Text style={[styles.detailValue, styles.modelName]}>{details.model}</Text>
                  </>
                )}

                {status === 'error' && (
                  <Text style={styles.hintText}>
                    Make sure Ollama is running:{'\n'}
                    <Text style={styles.hintCode}>ollama serve</Text>
                    {'\n'}and the model is available:{'\n'}
                    <Text style={styles.hintCode}>ollama pull mistral:latest</Text>
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.detailValue}>Checking connection…</Text>
            )}

            <TouchableOpacity
              style={styles.recheckBtn}
              onPress={() => { checkHealth(); setShowModal(false); }}
            >
              <Text style={styles.recheckBtnText}>Re-check Now</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 14,
    lineHeight: 20,
  },
  modelName: {
    fontFamily: 'monospace' ,
    color: '#4A7C6F',
    fontWeight: '600',
  },
  hintText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
  },
  hintCode: {
    fontFamily: 'monospace',
    color: '#374151',
    backgroundColor: '#F3F4F6',
  },
  recheckBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  recheckBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
