/**
 * VisualDisplay.js
 *
 * Renders ARASAAC pictograms for the keywords extracted from the user's transcript.
 *
 * Keyword extraction pipeline (post-migration):
 *   transcript text -> processed by Mistral -> passed as `keywords` prop
 *       → ARASAAC pictogram API per keyword
 *       → pictogram images displayed here
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, ActivityIndicator } from 'react-native';

export default function VisualDisplay({ transcript, keywords }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastProcessedKeywords = useRef('');
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
      lastProcessedKeywords.current = '';
      return;
    }

    if (!keywords || keywords.length === 0) {
      setImages([]);
      lastProcessedKeywords.current = '';
      return;
    }

    // Prevent re-fetching if keywords haven't changed and images are already loaded
    const currentKeywordsStr = keywords
      .map(k => (typeof k === 'object' && k !== null ? (k.label || k.keyword || k.text || '') : k))
      .join(',');

    // Fast-path: If all keywords are already resolved objects (e.g., predefined scenario pictograms),
    // immediately render them synchronously without async network fetching or delay.
    if (keywords.every(k => typeof k === 'object' && k !== null)) {
      const resolved = keywords.map(kw => ({
        keyword: kw.label || kw.keyword || '',
        label: kw.label || kw.keyword || '',
        text: kw.text || kw.label || kw.keyword || '',
        url: kw.url || null,
        isText: !!kw.isText || !kw.url,
      }));
      lastProcessedKeywords.current = currentKeywordsStr;
      setImages(resolved);
      setLoading(false);
      setError(null);
      fadeAnim.setValue(1);
      return;
    }

    if (currentKeywordsStr === lastProcessedKeywords.current && images.length > 0) {
      return;
    }

    const controller = new AbortController();
    
    const fetchImages = async () => {
      lastProcessedKeywords.current = currentKeywordsStr;
      setLoading(true);
      setError(null);

      try {
        const newImages = [];
        for (const kw of keywords) {
          if (controller.signal.aborted) return;

          // Support predefined demo items (with static image URLs or text fallbacks)
          if (typeof kw === 'object' && kw !== null) {
            if (kw.isText || !kw.url) {
              newImages.push({
                keyword: kw.label || kw.keyword || '',
                label: kw.label || kw.keyword || '',
                text: kw.text || kw.label || kw.keyword || '',
                url: null,
                isText: true,
              });
            } else {
              newImages.push({
                keyword: kw.label || kw.keyword || '',
                label: kw.label || kw.keyword || '',
                url: kw.url,
              });
            }
            continue;
          }

          // Directly handle distance indicators like "200 m" or "100 m"
          if (typeof kw === 'string' && /^\d+\s*m$/i.test(kw.trim())) {
            newImages.push({
              keyword: kw.trim(),
              label: kw.trim(),
              text: kw.trim(),
              url: null,
              isText: true,
            });
            continue;
          }

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
                  label: kw,
                  url: `https://static.arasaac.org/pictograms/${id}/${id}_500.png`,
                });
              } else {
                // If pictogram is unavailable in ARASAAC, display the text clearly in place
                newImages.push({
                  keyword: kw,
                  label: kw,
                  text: kw,
                  url: null,
                  isText: true,
                });
              }
            } else {
              newImages.push({
                keyword: kw,
                label: kw,
                text: kw,
                url: null,
                isText: true,
              });
            }
          } catch (pictoErr) {
            if (pictoErr.name === 'AbortError') return;
            console.warn(`[VisualDisplay] Pictogram fetch failed for "${kw}":`, pictoErr.message);
            newImages.push({
              keyword: kw,
              label: kw,
              text: kw,
              url: null,
              isText: true,
            });
          }
        }
        
        if (controller.signal.aborted) return;
        setImages(newImages);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[VisualDisplay] Image fetch failed:', err);
        setError('Failed to load visual communication images.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchImages();

    return () => {
      controller.abort();
    };
  }, [transcript, keywords]);

  useEffect(() => {
    if (images.length > 0 || error) {
      fadeAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
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
              {img.url ? (
                <Image
                  source={{ uri: img.url }}
                  style={[styles.image, images.length === 1 && styles.singleImage]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.image, styles.textCard, images.length === 1 && styles.singleTextCard]}>
                  <Text
                    style={[styles.textCardContent, images.length === 1 && styles.singleTextCardContent]}
                    numberOfLines={2}
                  >
                    {img.text || img.label || img.keyword}
                  </Text>
                </View>
              )}
              <Text
                style={[styles.imageLabel, images.length === 1 && styles.singleImageLabel]}
                numberOfLines={1}
              >
                {img.label || img.keyword}
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
  textCard: {
    backgroundColor: '#EEF4F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4E2DE',
    paddingHorizontal: 4,
  },
  singleTextCard: {
    paddingHorizontal: 10,
  },
  textCardContent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2A5C52',
    textAlign: 'center',
  },
  singleTextCardContent: {
    fontSize: 20,
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
