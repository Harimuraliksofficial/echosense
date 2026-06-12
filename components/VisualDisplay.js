/**
 * VisualDisplay.js
 *
 * Renders ARASAAC pictograms for the keywords extracted from the user's transcript.
 *
 * Keyword extraction pipeline (post-migration):
 *   transcript text
 *       → POST /api/extract-keywords  (Flask backend → Ollama Mistral)
 *       → ["keyword1", "keyword2", ...]
 *       → ARASAAC pictogram API per keyword
 *       → pictogram images displayed here
 *
 * All Gemini API references have been removed.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, ActivityIndicator } from 'react-native';
import { BACKEND_BASE_URL } from '../constants/config';

const KEYWORDS_ENDPOINT = `${BACKEND_BASE_URL}/api/extract-keywords`;

/**
 * Fetch keywords from the local Mistral model via the Flask backend.
 * Returns an array of keyword strings.
 */
const fetchOllamaKeywords = async (text, signal) => {
  const response = await fetch(KEYWORDS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Keyword API error (${response.status}): ${err.slice(0, 120)}`);
  }

  const data = await response.json();

  if (!data.keywords || !Array.isArray(data.keywords)) {
    throw new Error('Invalid response from keyword API: missing keywords array');
  }

  return data.keywords; // e.g. ["Mangalore", "AI", "project"]
};

export default function VisualDisplay({ transcript }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastProcessedText = useRef('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (
      !transcript ||
      transcript === 'Listening...' ||
      transcript.startsWith('Transcribing') ||
      transcript.startsWith('Error')
    ) {
      setImages([]);
      setError(null);
      return;
    }

    const normalizedText = transcript.trim().toLowerCase();
    if (normalizedText === lastProcessedText.current.trim().toLowerCase()) {
      return;
    }

    const controller = new AbortController();
    
    const timeoutId = setTimeout(async () => {
      lastProcessedText.current = transcript;
      setLoading(true);
      setError(null);

      try {
        // Step 1: Extract keywords via Ollama Mistral (through Flask backend)
        const keywords = await fetchOllamaKeywords(transcript, controller.signal);

        if (controller.signal.aborted) return;

        if (!keywords || keywords.length === 0) {
          setImages([]);
          setLoading(false);
          return;
        }

        // Step 2: Fetch ARASAAC pictograms for each keyword
        const newImages = [];
        for (const kw of keywords) {
          if (controller.signal.aborted) return;
          try {
            const response = await fetch(
              `https://api.arasaac.org/v1/pictograms/en/bestsearch/${encodeURIComponent(kw)}`,
              { signal: controller.signal }
            );
            if (response.ok) {
              const data = await response.json();
              if (controller.signal.aborted) return;
              if (data && data.length > 0) {
                const id = data[0]._id;
                newImages.push({
                  keyword: kw,
                  url: `https://static.arasaac.org/pictograms/${id}/${id}_500.png`,
                });
              }
            }
          } catch (pictoErr) {
            if (pictoErr.name === 'AbortError') return;
            // If one pictogram fails, continue with the rest
            console.warn(`[VisualDisplay] Pictogram fetch failed for "${kw}":`, pictoErr.message);
          }
        }
        
        if (controller.signal.aborted) return;
        setImages(newImages);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[VisualDisplay] Keyword extraction failed:', err);
        setError(err.message || 'Failed to extract keywords from transcript.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [transcript]);

  useEffect(() => {
    if (images.length > 0 || error) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [images, error, fadeAnim]);

  if (
    !transcript ||
    transcript === 'Listening...' ||
    transcript.startsWith('Transcribing') ||
    transcript.startsWith('Error') ||
    (images.length === 0 && !loading && !error)
  ) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholderEmoji}>🗣️</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#4A7C6F" />
      ) : error ? (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.imagesContainer, { opacity: fadeAnim }]}>
          {images.map((img, index) => (
            <View
              key={index}
              style={[styles.imageWrapper, images.length === 1 && styles.singleImageWrapper]}
            >
              <Image
                source={{ uri: img.url }}
                style={[styles.image, images.length === 1 && styles.singleImage]}
                resizeMode="contain"
              />
              <Text
                style={[styles.imageLabel, images.length === 1 && styles.singleImageLabel]}
              >
                {img.keyword}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  placeholderEmoji: {
    fontSize: 50,
    opacity: 0.1,
  },
  errorText: {
    fontSize: 14,
    color: '#D4726A',
    textAlign: 'center',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageWrapper: {
    alignItems: 'center',
    margin: 4,
  },
  singleImageWrapper: {
    margin: 20,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 4,
  },
  singleImage: {
    width: 140,
    height: 140,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'capitalize',
  },
  singleImageLabel: {
    fontSize: 18,
  },
});
