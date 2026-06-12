import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Alert 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BACKEND_BASE_URL } from '../constants/config';

export default function HistoryScreen({ onNavigateToHome }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${BACKEND_BASE_URL}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.warn("Failed to fetch history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all conversation history?",
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
              Alert.alert("Error", "Could not clear history");
            }
          }
        }
      ]
    );
  };

  const formatTime = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.timestamp}>{formatTime(item.created_at)}</Text>
      </View>
      <Text style={styles.messageText}>{item.message_text}</Text>
      
      {item.keywords && item.keywords.length > 0 && (
        <View style={styles.keywordsContainer}>
          <Text style={styles.keywordsLabel}>Keywords: </Text>
          <Text style={styles.keywordsText}>{item.keywords.join(', ')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>History</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={clearHistory} style={styles.clearBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color="#D4726A" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.subtitle}>Today's conversations. Cleared after 24 hours.</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4A7C6F" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="history" size={80} color="#EFEFEF" />
          <Text style={styles.emptyText}>No recent history</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchHistory}
          refreshing={isLoading}
        />
      )}

      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.homeBtn} onPress={onNavigateToHome} activeOpacity={0.8}>
          <MaterialCommunityIcons name="home-outline" size={34} color="#FFFFFF" />
        </TouchableOpacity>
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
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  clearBtn: {
    padding: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 120, // space for home button
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A7C6F',
  },
  messageText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    lineHeight: 28,
  },
  keywordsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  keywordsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888888',
  },
  keywordsText: {
    fontSize: 13,
    color: '#666666',
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#C0C0C0',
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
});
