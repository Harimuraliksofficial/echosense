import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CreateButton({ onPress, onClear, disabled }) {
  return (
    <View style={styles.container}>
      {onClear && (
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={onClear}
          activeOpacity={0.7}
        >
          <View style={styles.content}>
            <MaterialCommunityIcons name="delete-outline" size={20} color="#555555" style={styles.icon} />
            <Text style={styles.clearText}>Clear</Text>
          </View>
        </TouchableOpacity>
      )}
      <TouchableOpacity 
        style={[styles.button, disabled && styles.disabled]} 
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          <MaterialCommunityIcons name="eye-outline" size={20} color="#FFFFFF" style={styles.icon} />
          <Text style={styles.text}>Recognize</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    backgroundColor: '#333333', // Professional minimal dark gray
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  clearButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  clearText: {
    color: '#555555',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  }
});
