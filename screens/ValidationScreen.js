/**
 * ValidationScreen.js
 *
 * A dedicated test and validation page that exercises the full
 * Ollama Mistral keyword extraction pipeline end-to-end:
 *
 *   Input text  →  Extract keywords (Ollama)  →  Save to DB  →  Show pictograms
 *
 * Accessible from the FeatureHub screen as a modal.
 *
 * Sections:
 *   1. Input text box
 *   2. "Generate Keywords" button
 *   3. Keywords output (pill tags)
 *   4. Database save confirmation (shows record ID)
 *   5. Visualization preview (ARASAAC pictograms)
 *   6. API status indicator (live green / red dot)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ApiStatusIndicator from '../components/ApiStatusIndicator';
import { BACKEND_BASE_URL } from '../constants/config';

const KEYWORDS_ENDPOINT = `${BACKEND_BASE_URL}/api/extract-keywords`;

const SAMPLE_PROMPTS = [
  'I visited Mangalore and worked on an AI-powered plant identification project.',
  'I need a doctor urgently because I have a headache.',
  'I am thirsty and need water.',
  'Please help me find the nearest hospital.',
];

export default function ValidationScreen({ onClose }) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState(null);        // string[] | null
  const [dbRecord, setDbRecord] = useState(null);        // { id, source_text } | null
  const [pictograms, setPictograms] = useState([]);      // [{ keyword, url }]
  const [error, setError] = useState(null);
  const [pictoLoading, setPictoLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fadeIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setKeywords(null);
    setDbRecord(null);
    setPictograms([]);

    try {
      // 1. Extract keywords via Ollama (through Flask backend)
      const response = await fetch(KEYWORDS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText.trim() }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const extractedKeywords = data.keywords || [];
      const rowId = data.id;

      setKeywords(extractedKeywords);
      setDbRecord({ id: rowId, source_text: data.source_text || inputText.trim() });

      fadeIn();

      // 2. Fetch ARASAAC pictograms for each keyword
      if (extractedKeywords.length > 0) {
        setPictoLoading(true);
        const pics = [];
        for (const kw of extractedKeywords) {
          try {
            const picResp = await fetch(
              `https://api.arasaac.org/v1/pictograms/en/bestsearch/${encodeURIComponent(kw)}`
            );
            if (picResp.ok) {
              const picData = await picResp.json();
              if (picData && picData.length > 0) {
                const id = picData[0]._id;
                pics.push({
                  keyword: kw,
                  url: `https://static.arasaac.org/pictograms/${id}/${id}_500.png`,
                });
              }
            }
          } catch (_) {
            // continue with remaining keywords
          }
        }
        setPictograms(pics);
        setPictoLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSamplePress = (sample) => {
    setInputText(sample);
  };

  const handleClear = () => {
    setInputText('');
    setKeywords(null);
    setDbRecord(null);
    setPictograms([]);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <MaterialCommunityIcons name="chevron-down" size={26} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Validation Lab</Text>
          <View style={styles.headerStatus}>
            <ApiStatusIndicator />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Section 1: Input ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>① Input Text</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                multiline
                placeholder="Enter a sentence or paragraph to analyse…"
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                textAlignVertical="top"
                accessibilityLabel="Input text for keyword extraction"
              />
              {inputText.length > 0 && (
                <TouchableOpacity style={styles.clearInputBtn} onPress={handleClear}>
                  <MaterialCommunityIcons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Sample prompts */}
            <Text style={styles.samplesLabel}>Try a sample:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SAMPLE_PROMPTS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.sampleChip} onPress={() => handleSamplePress(s)}>
                  <Text style={styles.sampleChipText} numberOfLines={1}>{s.slice(0, 40)}…</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Generate Button ── */}
          <TouchableOpacity
            style={[styles.generateBtn, (!inputText.trim() || loading) && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!inputText.trim() || loading}
            accessibilityLabel="Generate keywords button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>Generate Keywords</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Error ── */}
          {error && (
            <View style={styles.errorCard}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Results (shown after successful extraction) ── */}
          {keywords !== null && (
            <Animated.View style={{ opacity: fadeAnim }}>
              {/* Section 2: Keywords Output */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>② Keywords Output</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{keywords.length}</Text>
                  </View>
                </View>
                {keywords.length === 0 ? (
                  <Text style={styles.emptyNote}>No keywords extracted. Try a more descriptive sentence.</Text>
                ) : (
                  <View style={styles.pillsContainer}>
                    {keywords.map((kw, i) => (
                      <View key={i} style={styles.pill}>
                        <Text style={styles.pillText}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Section 3: Database Save Confirmation */}
              {dbRecord && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>③ Database Confirmation</Text>
                  <View style={styles.dbCard}>
                    <View style={styles.dbRow}>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#22C55E" />
                      <Text style={styles.dbSavedText}>Saved to database</Text>
                    </View>
                    <View style={styles.dbDetailRow}>
                      <Text style={styles.dbLabel}>Record ID</Text>
                      <Text style={styles.dbValue}>#{dbRecord.id}</Text>
                    </View>
                    <View style={styles.dbDetailRow}>
                      <Text style={styles.dbLabel}>Source Text</Text>
                      <Text style={styles.dbValue} numberOfLines={2}>{dbRecord.source_text}</Text>
                    </View>
                    <View style={styles.dbDetailRow}>
                      <Text style={styles.dbLabel}>Keywords JSON</Text>
                      <Text style={[styles.dbValue, styles.monoText]}>{JSON.stringify(keywords)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Section 4: Visualization Preview */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>④ Visualization Preview</Text>
                {pictoLoading ? (
                  <View style={styles.pictoLoader}>
                    <ActivityIndicator size="large" color="#4A7C6F" />
                    <Text style={styles.pictoLoaderText}>Fetching pictograms…</Text>
                  </View>
                ) : pictograms.length === 0 ? (
                  <Text style={styles.emptyNote}>
                    {keywords.length === 0
                      ? 'No keywords to visualize.'
                      : 'No ARASAAC pictograms found for these keywords.'}
                  </Text>
                ) : (
                  <View style={styles.pictoGrid}>
                    {pictograms.map((pic, i) => (
                      <View key={i} style={styles.pictoCard}>
                        <Image
                          source={{ uri: pic.url }}
                          style={styles.pictoImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.pictoLabel}>{pic.keyword}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* ── Section 5: API Status ── */}
          <View style={[styles.section, styles.statusSection]}>
            <Text style={styles.sectionLabel}>⑤ API Status Indicator</Text>
            <View style={styles.statusRow}>
              <ApiStatusIndicator />
              <Text style={styles.statusHint}>  Tap the dot for connection details</Text>
            </View>
            <Text style={styles.statusSubtext}>
              Green = Ollama running + mistral:latest available{'\n'}
              Red = Server down or model missing
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerStatus: {
    marginLeft: 8,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    flex: 1,
  },
  badge: {
    backgroundColor: '#4A7C6F',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // Input
  inputBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    minHeight: 100,
    position: 'relative',
  },
  textInput: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
    minHeight: 80,
  },
  clearInputBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // Samples
  samplesLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 8,
  },
  sampleChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 220,
  },
  sampleChipText: {
    fontSize: 12,
    color: '#4338CA',
    fontWeight: '500',
  },

  // Generate button
  generateBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  generateBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    lineHeight: 20,
  },

  // Keywords pills
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  emptyNote: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },

  // DB card
  dbCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
  },
  dbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dbSavedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
  },
  dbDetailRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  dbLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    width: 90,
    paddingTop: 1,
  },
  dbValue: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
    color: '#4A7C6F',
  },

  // Pictograms
  pictoLoader: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  pictoLoaderText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  pictoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  pictoCard: {
    alignItems: 'center',
    width: 90,
  },
  pictoImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
  },
  pictoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'capitalize',
    textAlign: 'center',
  },

  // Status section
  statusSection: {
    marginBottom: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusHint: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 20,
  },
});
