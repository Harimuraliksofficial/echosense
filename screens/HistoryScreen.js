import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ApiStatusIndicator from '../components/ApiStatusIndicator';
import { BACKEND_BASE_URL } from '../constants/config';

export default function HistoryScreen({ onNavigateToHome }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_BASE_URL}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.warn("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClearHistory = () => {
    if (history.length === 0) return;
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all conversation history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete All", 
          style: "destructive", 
          onPress: async () => {
            try {
              const res = await fetch(`${BACKEND_BASE_URL}/api/history`, { method: 'DELETE' });
              if (res.ok) {
                setHistory([]);
              }
            } catch (e) {
              Alert.alert("Error", "Failed to clear history.");
            }
          }
        }
      ]
    );
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.historyItem}>
      <Text style={styles.timestamp}>{formatTime(item.created_at)}</Text>
      <Text style={styles.messageText}>{item.message}</Text>
      {item.keywords ? (
        <View style={styles.keywordsContainer}>
          <Text style={styles.keywordsLabel}>Keywords: </Text>
          <Text style={styles.keywordsText}>{item.keywords}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onNavigateToHome}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>Conversation History</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={{marginRight: 10}}>
            <ApiStatusIndicator />
          </View>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory} disabled={history.length === 0}>
            <MaterialCommunityIcons name="trash-can-outline" size={24} color={history.length === 0 ? "#CCC" : "#D4726A"} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4A7C6F" style={{ marginTop: 40 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="history" size={60} color="#E0E0E0" />
            <Text style={styles.emptyText}>No history for today.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Today</Text>
            <FlatList
              data={history}
              renderItem={renderItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    padding: 4,
  },
  clearBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 18,
    color: '#222',
    fontWeight: '500',
    marginBottom: 8,
  },
  keywordsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keywordsLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  keywordsText: {
    fontSize: 12,
    color: '#4A7C6F',
    fontWeight: '600',
  }
});
