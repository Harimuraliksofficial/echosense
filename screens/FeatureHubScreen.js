import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ValidationScreen from './ValidationScreen';

export default function FeatureHubScreen({ onNavigateToHome }) {
  const [showValidation, setShowValidation] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EchoSense Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information-outline" size={32} color="#3B82F6" style={{ marginBottom: 10 }} />
          <Text style={styles.infoTitle}>Software-Only Mode</Text>
          <Text style={styles.infoText}>
            EchoSense is now running in precision software-only mode. 
            Hardware dependencies and background services have been removed for maximum reliability.
          </Text>
        </View>

        <View style={styles.tile}>
          <Text style={styles.tileTitle}>Session History</Text>
          <Text style={styles.tileSubtitle}>Context is preserved for 20 minutes.</Text>
        </View>

        {/* ── Validation Lab tile ── */}
        <TouchableOpacity
          style={styles.validationTile}
          onPress={() => setShowValidation(true)}
          activeOpacity={0.8}
          accessibilityLabel="Open Validation Lab"
        >
          <View style={styles.validationTileLeft}>
            <MaterialCommunityIcons name="flask-outline" size={28} color="#4A7C6F" />
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.validationTileTitle}>Validation Lab</Text>
              <Text style={styles.validationTileSubtitle}>
                Test Ollama keyword extraction, DB storage, and pictograms end-to-end.
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.homeBtn} onPress={onNavigateToHome} activeOpacity={0.8}>
          <MaterialCommunityIcons name="home-outline" size={34} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Validation Screen Modal ── */}
      <Modal
        visible={showValidation}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowValidation(false)}
      >
        <ValidationScreen onClose={() => setShowValidation(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E3A8A',
    textAlign: 'center',
    lineHeight: 20,
  },
  tile: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginBottom: 14,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  tileSubtitle: {
    fontSize: 14,
    color: '#666666',
  },

  // Validation Lab tile
  validationTile: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  validationTileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  validationTileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 3,
  },
  validationTileSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    maxWidth: 220,
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
  },
});
