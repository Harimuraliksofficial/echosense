import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Modal, 
  TextInput, FlatList, Dimensions, ActivityIndicator, Image,
  Animated, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@ecosense_quickhelp_cards';

const DEFAULT_CARDS = [
  { id: '1', title: 'Food', keyword: 'food', message: 'I am hungry. I need food.', icon: 'silverware-fork-knife' },
  { id: '2', title: 'Water', keyword: 'water', message: 'I need water.', icon: 'water' },
  { id: '3', title: 'Toilet', keyword: 'toilet', message: 'I need to use the toilet.', icon: 'toilet' },
  { id: '4', title: 'Hospital', keyword: 'hospital', message: 'I need medical assistance.', icon: 'hospital-building' },
  { id: '5', title: 'Medicine', keyword: 'medicine', message: 'I need my medicine.', icon: 'pill' },
  { id: '6', title: 'Call Family', keyword: 'family', message: 'Please help me contact my family.', icon: 'phone-classic' },
  { id: '7', title: 'Help', keyword: 'help', message: 'I need help.', icon: 'alert-circle' },
  { id: '8', title: 'Safety', keyword: 'safe', message: 'I do not feel safe.', icon: 'shield-half-full' },
];

export default function QuickHelpScreen({ onNavigateToHome }) {
  const [cards, setCards] = useState([]);
  
  // Modals state
  const [showDisplayModal, setShowDisplayModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [activeCard, setActiveCard] = useState(null);
  const [displayImage, setDisplayImage] = useState(null);
  const [isFetchingImage, setIsFetchingImage] = useState(false);

  // Edit/Add Form State
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCards(JSON.parse(stored));
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CARDS));
        setCards(DEFAULT_CARDS);
      }
    } catch (e) {
      console.warn('Failed to load cards');
      setCards(DEFAULT_CARDS);
    }
  };

  const saveCards = async (newCards) => {
    try {
      setCards(newCards);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newCards));
    } catch (e) {
      console.warn('Failed to save cards');
    }
  };

  const openDisplayModal = async (card) => {
    setActiveCard(card);
    setDisplayImage(null);
    setShowDisplayModal(true);
    setIsFetchingImage(true);
    fadeAnim.setValue(0);

    try {
      const res = await fetch(`https://api.arasaac.org/v1/pictograms/en/bestsearch/${encodeURIComponent(card.keyword || card.title)}`);
      if (!res.ok) throw new Error("ARASAAC API failed");
      const data = await res.json();
      if (data && data.length > 0) {
        const id = data[0]._id;
        setDisplayImage(`https://static.arasaac.org/pictograms/${id}/${id}_500.png`);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }).start();
      }
    } catch (e) {
      // Ignore, displayImage stays null
    } finally {
      setIsFetchingImage(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setFormTitle('');
    setFormMessage('');
    setActiveCard(null);
    setShowEditModal(true);
  };

  const openEditModal = (card) => {
    setIsEditing(true);
    setActiveCard(card);
    setFormTitle(card.title);
    setFormMessage(card.message);
    setShowEditModal(true);
  };

  const handleSaveCard = () => {
    if (!formTitle.trim() || !formMessage.trim()) {
      Alert.alert('Validation Error', 'Title and message cannot be empty.');
      return;
    }
    
    if (isEditing && activeCard) {
      const newCards = cards.map(c => 
        c.id === activeCard.id ? { ...c, title: formTitle, keyword: formTitle, message: formMessage } : c
      );
      saveCards(newCards);
    } else {
      const newCard = {
        id: Date.now().toString(),
        title: formTitle,
        keyword: formTitle,
        message: formMessage,
        icon: 'star-outline' // Default icon for custom
      };
      saveCards([...cards, newCard]);
    }
    setShowEditModal(false);
  };

  const handleDeleteCard = () => {
    Alert.alert('Delete Card', 'Are you sure you want to delete this custom card?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
          const newCards = cards.filter(c => c.id !== activeCard.id);
          saveCards(newCards);
          setShowEditModal(false);
      }}
    ]);
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => openDisplayModal(item)}
      onLongPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardIconBox}>
        <MaterialCommunityIcons name={item.icon || 'star-outline'} size={40} color="#4A7C6F" />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <TouchableOpacity 
        style={styles.editBtn} 
        onPress={() => openEditModal(item)}
        hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
      >
        <MaterialCommunityIcons name="dots-horizontal" size={24} color="#C0C0C0" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Help</Text>
        <Text style={styles.subtitle}>Tap a card to instantly communicate your needs.</Text>
      </View>

      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
        <MaterialCommunityIcons name="plus" size={34} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.homeBtn} onPress={onNavigateToHome} activeOpacity={0.8}>
          <MaterialCommunityIcons name="home-outline" size={34} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Full-Screen Communication View ── */}
      <Modal visible={showDisplayModal} animationType="fade" transparent={false} presentationStyle="fullScreen">
        <SafeAreaView style={styles.fullScreenContainer}>
          <View style={styles.fullScreenTop}>
            {isFetchingImage ? (
              <ActivityIndicator size="large" color="#4A7C6F" />
            ) : displayImage ? (
              <Animated.Image 
                source={{ uri: displayImage }} 
                style={[styles.fullScreenImage, { opacity: fadeAnim }]} 
                resizeMode="contain" 
              />
            ) : (
              <MaterialCommunityIcons name="image-off-outline" size={150} color="#E0E0E0" />
            )}
          </View>

          <View style={styles.fullScreenMiddle}>
            <Text style={styles.fullScreenMessage} adjustsFontSizeToFit numberOfLines={4}>
              {activeCard?.message?.toUpperCase()}
            </Text>
          </View>

          <View style={styles.fullScreenBottom}>
            <TouchableOpacity style={styles.fsBtnBack} onPress={() => setShowDisplayModal(false)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="arrow-left" size={28} color="#4A7C6F" />
              <Text style={styles.fsBtnBackText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fsBtnHome} onPress={() => {
              setShowDisplayModal(false);
              onNavigateToHome();
            }} activeOpacity={0.7}>
              <MaterialCommunityIcons name="home" size={28} color="#FFFFFF" />
              <Text style={styles.fsBtnHomeText}>Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Add / Edit Modal ── */}
      <Modal visible={showEditModal} animationType="slide" transparent={true} onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editHeaderRow}>
              <Text style={styles.editTitle}>{isEditing ? 'Edit Card' : 'Add Custom Card'}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <MaterialCommunityIcons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Title / Keyword</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Snack"
              value={formTitle}
              onChangeText={setFormTitle}
              maxLength={20}
            />

            <Text style={styles.label}>Predefined Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. I would like a snack please."
              value={formMessage}
              onChangeText={setFormMessage}
              multiline
              textAlignVertical="top"
              maxLength={150}
            />

            <View style={styles.editActions}>
              {isEditing && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteCard}>
                  <MaterialCommunityIcons name="delete-outline" size={24} color="#FFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCard}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 6,
    textAlign: 'center',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 120, // space for home button
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    width: cardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  cardIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F9F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
  editBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  homeBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addBtn: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A7C6F',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#4A7C6F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Full-Screen Communication View Styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    justifyContent: 'space-between',
  },
  fullScreenTop: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  fullScreenImage: {
    width: '80%',
    height: '100%',
    maxHeight: 350,
  },
  fullScreenMiddle: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenMessage: {
    fontSize: 48,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    lineHeight: 56,
  },
  fullScreenBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  fsBtnBack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9F6',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4A7C6F',
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  fsBtnBackText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4A7C6F',
    marginLeft: 8,
  },
  fsBtnHome: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  fsBtnHomeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  editModalContent: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  editHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  textArea: {
    height: 100,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: '#4A7C6F',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#D4726A',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
