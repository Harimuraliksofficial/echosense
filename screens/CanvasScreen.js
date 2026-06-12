import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, Pressable, Dimensions, PanResponder, Animated
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

import CreateButton from '../components/CreateButton';
import { BACKEND_BASE_URL } from '../constants/config';

const PASTEL_COLORS = ['#222222', '#7EB8DA', '#A8D5BA', '#F4C2C2', '#C3B1E1'];
const STROKE_SIZES = [2, 4, 7];

export default function CanvasScreen({ onNavigateToHome }) {
  const [mode, setMode] = useState('write');
  const [text, setText] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);

  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [strokeColor, setStrokeColor] = useState('#222222');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [strokeSizeIndex, setStrokeSizeIndex] = useState(1);

  // AI Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [recognizedKeyword, setRecognizedKeyword] = useState(null);
  const [isFetchingArasaac, setIsFetchingArasaac] = useState(false);
  const [arasaacError, setArasaacError] = useState(false);
  
  const [modelStatus, setModelStatus] = useState('checking'); // 'checking', 'ready', 'error'
  const abortControllerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/health`);
        const data = await res.json();
        if (data.status === 'ok' && data.qwen_available) {
          setModelStatus('ready');
        } else {
          setModelStatus('error');
        }
      } catch {
        setModelStatus('error');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (generatedImage) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true
      }).start();
    }
  }, [generatedImage, fadeAnim]);

  const captureViewRef = useRef(null);

  // Use refs for values needed inside PanResponder callbacks
  const colorRef = useRef(strokeColor);
  const widthRef = useRef(strokeWidth);
  const eraserRef = useRef(isEraser);
  const pathStrRef = useRef('');

  // Keep refs in sync (safely inside effect for React Compiler)
  useEffect(() => {
    colorRef.current = strokeColor;
    widthRef.current = strokeWidth;
    eraserRef.current = isEraser;
  }, [strokeColor, strokeWidth, isEraser]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        pathStrRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setCurrentPath(pathStrRef.current);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        pathStrRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setCurrentPath(pathStrRef.current);
      },
      onPanResponderRelease: () => {
        const pathStr = pathStrRef.current;
        if (pathStr && pathStr.length > 10) {
          if (eraserRef.current) {
            setPaths(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
          } else {
            setPaths(prev => [...prev, {
              d: pathStr,
              color: colorRef.current,
              width: widthRef.current,
            }]);
          }
        }
        pathStrRef.current = '';
        setCurrentPath('');
      },
    })
  ).current;

  const handleReset = () => {
    setShowClearModal(true);
  };

  const confirmClear = () => {
    setText('');
    setPaths([]);
    setCurrentPath('');
    setGeneratedImage(null);
    setRecognizedKeyword(null);
    setArasaacError(false);
    setIsFetchingArasaac(false);
    setShowClearModal(false);
  };

  const handleClearCanvas = () => {
    setPaths([]);
    setCurrentPath('');
    setGeneratedImage(null);
    setRecognizedKeyword(null);
    setArasaacError(false);
    setIsFetchingArasaac(false);
  };

  const cycleStrokeSize = () => {
    const nextIndex = (strokeSizeIndex + 1) % STROKE_SIZES.length;
    setStrokeSizeIndex(nextIndex);
    setStrokeWidth(STROKE_SIZES[nextIndex]);
  };

  const handleCreate = async () => {
    if (paths.length === 0) return;
    
    // Cancel pending requests
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setIsGenerating(true);
      const uri = await captureRef(captureViewRef, {
        format: 'png',
        quality: 0.8,
        result: 'base64'
      });
      
      const payload = {
        sketch_b64: `data:image/png;base64,${uri}`
      };
      
      const response = await fetch(`${BACKEND_BASE_URL}/api/recognize-canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });
      
      const data = await response.json();

      if (!response.ok) {
         throw new Error(data.error || `Server error (${response.status})`);
      }
      
      if (data.keyword) {
         setRecognizedKeyword(data.keyword);
         setPaths([]); // Clear drawing instantly
         setIsGenerating(false); // Stop Qwen loading immediately
         
         setIsFetchingArasaac(true);
         setArasaacError(false);
         
         // Fetch ARASAAC pictogram in background
         try {
             const arasaacRes = await fetch(`https://api.arasaac.org/v1/pictograms/en/bestsearch/${encodeURIComponent(data.keyword)}`);
             if (!arasaacRes.ok) throw new Error("ARASAAC API failed");
             const arasaacData = await arasaacRes.json();
             if (arasaacData && arasaacData.length > 0) {
                 const id = arasaacData[0]._id;
                 setGeneratedImage(`https://static.arasaac.org/pictograms/${id}/${id}_500.png`);
             } else {
                 setArasaacError(true);
             }
         } catch (err) {
             setArasaacError(true);
         } finally {
             setIsFetchingArasaac(false);
         }
      } else {
         console.error('Error generating image', data.error);
         Alert.alert("Error", data.error || "The AI server returned an error.");
      }
    } catch (err) {
       if (err.name === 'AbortError') return; // Ignore aborted requests silently
       console.error("AI Generation Error", err);
       Alert.alert("Recognition Failed", err.message || "Failed to recognize drawing. Ensure backend is running.");
    } finally {
       if (!abortControllerRef.current?.signal.aborted) {
           setIsGenerating(false);
       }
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    try {
      const base64Data = generatedImage.replace('data:image/png;base64,', '');
      const fileUri = FileSystem.documentDirectory + `generated_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      Alert.alert('Saved', 'The generated AI image has been saved to your local storage.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save the image.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Notes</Text>
          <View style={[styles.statusDot, { backgroundColor: modelStatus === 'ready' ? '#4CAF50' : (modelStatus === 'checking' ? '#FFC107' : '#F44336') }]} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {generatedImage && (
            <TouchableOpacity onPress={handleDownload} style={[styles.resetBtn, { marginRight: 10 }]}>
              <MaterialCommunityIcons name="download-outline" size={24} color="#4A7C6F" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <MaterialCommunityIcons name="delete-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'write' && styles.toggleActive]}
          onPress={() => setMode('write')}
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={20}
            color={mode === 'write' ? '#4A7C6F' : '#999'}
          />
          <Text style={[styles.toggleText, mode === 'write' && styles.toggleTextActive, { marginLeft: 8 }]}>
            Write
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'draw' && styles.toggleActive]}
          onPress={() => setMode('draw')}
        >
          <MaterialCommunityIcons
            name="draw"
            size={20}
            color={mode === 'draw' ? '#4A7C6F' : '#999'}
          />
          <Text style={[styles.toggleText, mode === 'draw' && styles.toggleTextActive, { marginLeft: 8 }]}>
            Draw
          </Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Area */}
      <View style={styles.canvasArea}>
        {mode === 'write' ? (
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Start typing here..."
            placeholderTextColor="#C0C0C0"
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
        ) : (
          <View style={styles.drawContainer}>
            {/* Drawing toolbar */}
            <View style={styles.drawToolbar}>
              <TouchableOpacity
                style={[styles.toolBtn, !isEraser && styles.toolBtnActive]}
                onPress={() => setIsEraser(false)}
              >
                <MaterialCommunityIcons name="pen" size={20} color={!isEraser ? '#4A7C6F' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolBtn, isEraser && styles.toolBtnActive]}
                onPress={() => setIsEraser(true)}
              >
                <MaterialCommunityIcons name="eraser" size={20} color={isEraser ? '#D4726A' : '#999'} />
              </TouchableOpacity>

              <View style={styles.toolDivider} />

              <TouchableOpacity style={styles.toolBtn} onPress={cycleStrokeSize}>
                <View style={[styles.strokePreview, {
                  width: STROKE_SIZES[strokeSizeIndex] * 3,
                  height: STROKE_SIZES[strokeSizeIndex] * 3
                }]} />
              </TouchableOpacity>

              <View style={styles.toolDivider} />

              {PASTEL_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    strokeColor === color && !isEraser && styles.colorDotActive,
                  ]}
                  onPress={() => { setStrokeColor(color); setIsEraser(false); }}
                />
              ))}
            </View>

            {/* SVG Canvas */}
            <View style={styles.svgContainer} {...panResponder.panHandlers} ref={captureViewRef}>
              {recognizedKeyword && (
                <View style={styles.keywordBanner}>
                  <Text style={styles.keywordText}>{recognizedKeyword.toUpperCase()}</Text>
                  {isFetchingArasaac && <ActivityIndicator size="small" color="#4A7C6F" style={{marginLeft: 10}} />}
                </View>
              )}
              {recognizedKeyword && arasaacError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>ARASAAC image unavailable</Text>
                </View>
              )}
              {generatedImage && (
                <Animated.View style={[StyleSheet.absoluteFill, { 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    backgroundColor: '#FFFFFF',
                    opacity: fadeAnim,
                    shadowColor: '#4A7C6F',
                    shadowOpacity: 0.4,
                    shadowRadius: 15,
                    elevation: 10,
                }]}>
                  <Image 
                    source={{ uri: generatedImage }} 
                    style={{ width: '80%', height: '80%' }} 
                    resizeMode="contain" 
                  />
                </Animated.View>
              )}
              <Svg style={StyleSheet.absoluteFill}>
                {paths.map((p, i) => (
                  <Path
                    key={i}
                    d={p.d}
                    stroke={p.color}
                    strokeWidth={p.width}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath ? (
                  <Path
                    d={currentPath}
                    stroke={isEraser ? '#CCCCCC' : strokeColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>
            </View>
            
            <CreateButton onPress={handleCreate} onClear={handleClearCanvas} disabled={paths.length === 0} />
          </View>
        )}
      </View>

      {/* Home Navigation Button */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity style={styles.homeBtn} onPress={onNavigateToHome}>
          <MaterialCommunityIcons name="home-outline" size={30} color="#222222" />
        </TouchableOpacity>
      </View>

      {/* Modern Curvy Clear Modal */}
      <Modal
        visible={showClearModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowClearModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reset Canvas?</Text>
              <Text style={styles.modalMessage}>This will permanently delete all your notes and drawings on this screen.</Text>
              
              <View style={styles.modalActionRow}>
                <TouchableOpacity 
                  style={styles.modalBtnCancel} 
                  onPress={() => setShowClearModal(false)}
                >
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalBtnDelete} 
                  onPress={confirmClear}
                >
                  <Text style={styles.modalBtnTextDelete}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Loading Overlay */}
      {isGenerating && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4A7C6F" />
            <Text style={styles.loadingText}>Recognizing drawing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 4,
  },
  resetBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // ~25% increase (9.5-10 is ~10% visual area increase)
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: '#F8F8F8',
    marginHorizontal: 4,
  },
  toggleActive: {
    backgroundColor: '#E0F0E8',
  },
  toggleText: {
    fontSize: 16, // From 14
    color: '#999',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#4A7C6F',
    fontWeight: '600',
  },
  canvasArea: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 28,
    color: '#222',
    padding: 16,
  },
  drawContainer: {
    flex: 1,
  },
  drawToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  toolBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8F8F8',
    marginRight: 4,
  },
  toolBtnActive: {
    backgroundColor: '#E8F4EE',
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 2,
  },
  strokePreview: {
    borderRadius: 50,
    backgroundColor: '#222',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#4A7C6F',
    borderWidth: 2.5,
  },
  svgContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  bottomNavContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  homeBtn: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28, // High curvy radius
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnDelete: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF3B30', // Apple Red
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  modalBtnTextDelete: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  keywordBanner: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  keywordText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 1.5,
  },
  errorBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: '#FFF0F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    zIndex: 20,
    elevation: 10,
  },
  errorText: {
    color: '#D4726A',
    fontWeight: '600',
    fontSize: 14,
  },
});
