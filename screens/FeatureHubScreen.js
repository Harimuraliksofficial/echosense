import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Switch, TextInput, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';


// Enable LayoutAnimation on Android (skip on New Architecture where it's a no-op)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental && !global.__turboModuleProxy) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ALARM_STORAGE_KEY = '@ecosense_alarm';
const REMINDER_STORAGE_KEY = '@ecosense_reminder';
const TARGET_NAME_STORAGE_KEY = '@ecosense_target_name';

const FeatureTile = React.memo(({ title, isActive, onToggle, onPress, disabled, children, subtitle, isExpanded, onPressExpand }) => (
  <View style={[styles.tile, disabled && styles.tileDisabled, isExpanded && styles.tileExpanded]}>
    <TouchableOpacity 
      style={styles.tileHeader} 
      activeOpacity={disabled ? 1 : 0.7} 
      onPress={disabled ? () => {} : (onPress ? onPress : onPressExpand)}
    >
      <View style={styles.tileTitleRow}>
        <Text style={[styles.tileTitle, disabled && styles.textDisabled]}>{title}</Text>
        {disabled && <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>}
      </View>
      {!disabled && onToggle && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{isActive ? 'ON' : 'OFF'}</Text>
          <View style={[styles.statusIndicator, isActive ? styles.indicatorOn : styles.indicatorOff]} />
        </View>
      )}
    </TouchableOpacity>
    {subtitle && !disabled && !isExpanded && (
       <View style={styles.subtitleRow}><Text style={styles.subtitleText}>{subtitle}</Text></View>
    )}
    {isExpanded && !disabled && (
      <View style={styles.tileContent}>
        {children}
      </View>
    )}
  </View>
));

export default function FeatureHubScreen({ 
  onNavigateToHome, activeNameListener, onToggleNameListener, 
  targetName, onSaveName,
  latestTranscript, listenerState, matchStatus, lastTriggerTime, isListening, onRefreshListener 
}) {
  const [expandedTile, setExpandedTile] = useState(null);
  
  // States
  const [alarm, setAlarm] = useState({ active: false, time: new Date() });
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [showAlarmPopup, setShowAlarmPopup] = useState(false);

  const [reminder, setReminder] = useState({ active: false, time: new Date(), text: '' });
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showReminderPopup, setShowReminderPopup] = useState(false);

  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  // Refs for current state in interval
  const alarmRef = useRef(alarm);
  const reminderRef = useRef(reminder);
  
  // Refs for Audio objects
  const alarmSoundRef = useRef(null);
  const reminderSoundRef = useRef(null);

  useEffect(() => {
    alarmRef.current = alarm;
    reminderRef.current = reminder;
  }, [alarm, reminder]);

  // Load saved states
  useEffect(() => {
    loadData();
    
    // Background checker for alarms and reminders
    const interval = setInterval(() => {
      const now = new Date();
      const currentAlarm = alarmRef.current;
      const currentReminder = reminderRef.current;

      if (currentAlarm.active && currentAlarm.time.getHours() === now.getHours() && currentAlarm.time.getMinutes() === now.getMinutes()) {
        triggerAlarm();
        const updated = { ...currentAlarm, active: false };
        setAlarm(updated);
        saveData(ALARM_STORAGE_KEY, updated);
      }

      if (currentReminder.active && currentReminder.time.getHours() === now.getHours() && currentReminder.time.getMinutes() === now.getMinutes()) {
        triggerReminder();
        const updated = { ...currentReminder, active: false };
        setReminder(updated);
        saveData(REMINDER_STORAGE_KEY, updated);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const savedAlarm = await AsyncStorage.getItem(ALARM_STORAGE_KEY);
      if (savedAlarm) {
        const parsed = JSON.parse(savedAlarm);
        setAlarm({ active: parsed.active, time: new Date(parsed.time) });
      }
      const savedReminder = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
      if (savedReminder) {
        const parsed = JSON.parse(savedReminder);
        setReminder({ active: parsed.active, time: new Date(parsed.time), text: parsed.text });
      }
    } catch (e) {
      console.log('Error loading data', e);
    }
  };

  const handleSaveName = (nameToSave) => {
    const validName = nameToSave.trim();
    if (!validName) {
      onSaveName('');
      onToggleNameListener(false);
      setShowNameModal(false);
      toggleExpand(null);
      return;
    }

    onSaveName(validName);
    onToggleNameListener(true);
    setShowNameModal(false);
    toggleExpand(null);
  };

  const saveData = async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.log('Error saving data', e);
    }
  };

  const triggerAlarm = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/beep.aac'),
        { isLooping: true, shouldPlay: true }
      );
      alarmSoundRef.current = sound;
      setShowAlarmPopup(true);
    } catch (e) {
      console.log('Error playing alarm', e);
      setShowAlarmPopup(true); // Fallback to visual modal
    }
  };

  const stopAlarm = async () => {
    if (alarmSoundRef.current) {
      try {
        await alarmSoundRef.current.stopAsync();
        await alarmSoundRef.current.unloadAsync();
      } catch(e) { console.log('Error stopping alarm', e); }
      alarmSoundRef.current = null;
    }
    setShowAlarmPopup(false);
  };

  const triggerReminder = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { sound } = await Audio.Sound.createAsync(
         require('../assets/beep.aac'),
         { shouldPlay: true }
      );
      reminderSoundRef.current = sound;
      setShowReminderPopup(true);
    } catch (e) {
      console.log('Error playing reminder beep', e);
      setShowReminderPopup(true); // Still show popup even if audio fails
    }
  };

  const toggleExpand = (tileName) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTile(expandedTile === tileName ? null : tileName);
  };

  const handleAlarmTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowAlarmPicker(false);
    if (selectedDate) {
      const updated = { ...alarm, time: selectedDate };
      setAlarm(updated);
      saveData(ALARM_STORAGE_KEY, updated);
    }
  };

  const handleReminderTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowReminderPicker(false);
    if (selectedDate) {
      const updated = { ...reminder, time: selectedDate };
      setReminder(updated);
      saveData(REMINDER_STORAGE_KEY, updated);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.title}>Customizable Pro Features</Text>
        {activeNameListener ? (
          <TouchableOpacity 
            onPress={() => {
              onToggleNameListener(false);
              setTimeout(() => onToggleNameListener(true), 500);
            }} 
            style={{ width: 24, alignItems: 'center' }} 
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={26} color="#1A202C" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <FeatureTile 
          title="Active Name Listener" 
          isActive={activeNameListener} 
          onToggle={() => {}} 
          subtitle={activeNameListener ? (listenerState || 'Listening') : 'Inactive'}
          isExpanded={expandedTile === 'Active Name Listener'}
          onPressExpand={() => toggleExpand('Active Name Listener')}
        >
          <View style={styles.setupRow}>
            <View style={styles.timeSelectGroup}>
               <Text style={styles.label}>Master Switch</Text>
               <Text style={styles.timeText}>{activeNameListener ? 'Enabled' : 'Disabled'}</Text>
            </View>
            <View style={styles.switchGroup}>
               <Text style={styles.label}>Enable</Text>
               <Switch 
                 value={activeNameListener} 
                 onValueChange={(val) => {
                   onToggleNameListener(val);
                   if (val) toggleExpand(null);
                 }} 
                 trackColor={{ false: '#E0E0E0', true: '#A7F3D0' }}
                 thumbColor={activeNameListener ? '#10B981' : '#F4F4F4'}
               />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.setupRow, {marginTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10}]}
            onPress={() => {
              setTempName(targetName);
              setShowNameModal(true);
            }}
          >
            <View style={styles.timeSelectGroup}>
               <Text style={styles.label}>Target Name</Text>
               <Text style={styles.timeText}>{targetName || 'Hello'}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E0" />
          </TouchableOpacity>

          {/* Confirmation Message */}
          <View style={{marginTop: 12, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8}}>
             <Text style={{color: '#166534', fontSize: 13, textAlign: 'center'}}>
               Device will activate when it hears{' '}
               <Text style={{fontWeight: 'bold'}}>"Hello"</Text>
               {targetName ? <Text> or <Text style={{fontWeight: 'bold'}}>"Hello {targetName}"</Text></Text> : null}
             </Text>
          </View>

          {activeNameListener && (
            <>
              {/* Minimal Status */}
              <View style={{marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                   <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: isListening ? '#10B981' : '#9CA3AF', marginRight: 8}} />
                   <Text style={{color: '#4B5563', fontSize: 14}}>{listenerState || 'Idle'}</Text>
                </View>
                {matchStatus ? (
                  <Text style={{color: '#DC2626', fontWeight: 'bold', fontSize: 14}}>{matchStatus}</Text>
                ) : null}
              </View>

              {/* Refresh Button */}
              <TouchableOpacity 
                style={{marginTop: 12, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'}}
                onPress={onRefreshListener}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="refresh" size={18} color="#374151" style={{marginRight: 6}} />
                <Text style={{color: '#374151', fontWeight: '600', fontSize: 14}}>Refresh Listener</Text>
              </TouchableOpacity>
            </>
          )}
        </FeatureTile>

        <FeatureTile 
          title="Alarm" 
          isActive={alarm.active} 
          onToggle={() => {}} 
          subtitle={alarm.active ? `Set for ${formatTime(alarm.time)}` : 'Inactive'}
          isExpanded={expandedTile === 'Alarm'}
          onPressExpand={() => toggleExpand('Alarm')}
        >
          <View style={styles.setupRow}>
            <View style={styles.timeSelectGroup}>
               <Text style={styles.label}>Time</Text>
               <TouchableOpacity style={styles.timeBox} onPress={() => setShowAlarmPicker(true)}>
                 <Text style={styles.timeText}>{formatTime(alarm.time)}</Text>
               </TouchableOpacity>
            </View>
            <View style={styles.switchGroup}>
               <Text style={styles.label}>Enable</Text>
               <Switch 
                 value={alarm.active} 
                 onValueChange={(val) => {
                   const updated = { ...alarm, active: val };
                   setAlarm(updated);
                   saveData(ALARM_STORAGE_KEY, updated);
                   if (val) toggleExpand(null);
                 }} 
                 trackColor={{ false: '#E0E0E0', true: '#A7F3D0' }}
                 thumbColor={alarm.active ? '#10B981' : '#F4F4F4'}
               />
            </View>
          </View>
          {showAlarmPicker && Platform.OS !== 'web' && (
            <DateTimePicker
              value={alarm.time}
              mode="time"
              is24Hour={false}
              onChange={handleAlarmTimeChange}
            />
          )}
          {showAlarmPicker && Platform.OS === 'web' && (
            <View style={{padding: 10}}><Text style={{color:'red'}}>Time picker disabled on Web</Text></View>
          )}

          <TouchableOpacity style={styles.testAudioBtn} onPress={triggerAlarm} activeOpacity={0.7}>
            <MaterialCommunityIcons name="play-circle" size={20} color="#06501A" />
            <Text style={styles.testAudioText}>Test Alarm Sound</Text>
          </TouchableOpacity>
        </FeatureTile>

        <FeatureTile 
          title="Reminder" 
          isActive={reminder.active} 
          onToggle={() => {}}
          subtitle={reminder.active ? `Set for ${formatTime(reminder.time)}` : 'Inactive'}
          isExpanded={expandedTile === 'Reminder'}
          onPressExpand={() => toggleExpand('Reminder')}
        >
           <View style={styles.setupRow}>
            <View style={styles.timeSelectGroup}>
               <Text style={styles.label}>Time</Text>
               <TouchableOpacity style={styles.timeBox} onPress={() => setShowReminderPicker(true)}>
                 <Text style={styles.timeText}>{formatTime(reminder.time)}</Text>
               </TouchableOpacity>
            </View>
            <View style={styles.switchGroup}>
               <Text style={styles.label}>Enable</Text>
               <Switch 
                 value={reminder.active} 
                 onValueChange={(val) => {
                   const updated = { ...reminder, active: val };
                   setReminder(updated);
                   saveData(REMINDER_STORAGE_KEY, updated);
                   if (val) toggleExpand(null);
                 }} 
                 trackColor={{ false: '#E0E0E0', true: '#A7F3D0' }}
                 thumbColor={reminder.active ? '#10B981' : '#F4F4F4'}
               />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter reminder (e.g., take medicine)"
              placeholderTextColor="#AAAAAA"
              value={reminder.text}
              onChangeText={(txt) => {
                const updated = { ...reminder, text: txt };
                setReminder(updated);
                saveData(REMINDER_STORAGE_KEY, updated);
              }}
            />
          </View>
          {showReminderPicker && Platform.OS !== 'web' && (
            <DateTimePicker
              value={reminder.time}
              mode="time"
              is24Hour={false}
              onChange={handleReminderTimeChange}
            />
          )}
          {showReminderPicker && Platform.OS === 'web' && (
            <View style={{padding: 10}}><Text style={{color:'red'}}>Time picker disabled on Web</Text></View>
          )}

          <TouchableOpacity style={styles.testAudioBtn} onPress={triggerReminder} activeOpacity={0.7}>
            <MaterialCommunityIcons name="play-circle" size={20} color="#06501A" />
            <Text style={styles.testAudioText}>Test Reminder Sound</Text>
          </TouchableOpacity>
        </FeatureTile>

        <FeatureTile title="Destination Alert" disabled={true} />
        <FeatureTile title="Call Alert" disabled={true} />

      </ScrollView>

      {/* Deep Central Home Button */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.homeBtn} onPress={onNavigateToHome} activeOpacity={0.8}>
          <MaterialCommunityIcons name="home-outline" size={34} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Target Name Input View */}
      {showNameModal && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.alarmModal}>
            <MaterialCommunityIcons name="account-search-outline" size={60} color="#3B82F6" style={{marginBottom: 20}} />
            <Text style={styles.modalTitle}>Set Target Name</Text>
            <Text style={styles.modalText}>What name should I listen for in the background?</Text>
            <TextInput 
               style={[styles.textInput, { width: '100%', marginBottom: 20 }]}
               placeholder="Enter name (e.g., Rajeev)"
               value={tempName}
               onChangeText={setTempName}
               autoFocus
            />
            <View style={{flexDirection: 'row', width: '100%', justifyContent: 'space-between'}}>
               <TouchableOpacity style={[styles.stopButton, {backgroundColor: '#F3F4F6', flex: 1, marginRight: 10}]} onPress={() => setShowNameModal(false)}>
                 <Text style={[styles.stopButtonText, {color: '#6B7280'}]}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.stopButton, {backgroundColor: '#DBEAFE', flex: 1}]} onPress={() => handleSaveName(tempName)}>
                 <Text style={[styles.stopButtonText, {color: '#1D4ED8'}]}>Save Name</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Playing Alarm Absolute View */}
      {showAlarmPopup && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.alarmModal}>
            <MaterialCommunityIcons name="alarm-bell" size={60} color="#FF4757" style={{marginBottom: 20}} />
            <Text style={styles.modalTitle}>Alarm Ringing!</Text>
            <TouchableOpacity style={styles.stopButton} onPress={stopAlarm}>
              <Text style={styles.stopButtonText}>Stop Alarm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reminder Absolute View */}
      {showReminderPopup && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.alarmModal}>
            <MaterialCommunityIcons name="calendar-check" size={60} color="#10B981" style={{marginBottom: 20}} />
            <Text style={styles.modalTitle}>Reminder</Text>
            <Text style={styles.modalText}>{reminder.text || 'Time is up!'}</Text>
            <TouchableOpacity style={[styles.stopButton, {backgroundColor: '#ECFDF5'}]} onPress={() => setShowReminderPopup(false)}>
              <Text style={[styles.stopButtonText, {color: '#06501A'}]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Very soft off-white/pastel beige
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Provide massive breathing room for the bottom Home button
  },
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  tileDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E8E8E8',
  },
  tileExpanded: {
    borderColor: '#EAF4FF',
    backgroundColor: '#FCFEFF',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  textDisabled: {
    color: '#999999',
  },
  badge: {
    backgroundColor: '#EAEAEA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    marginRight: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorOn: {
    backgroundColor: '#10B981',
  },
  indicatorOff: {
    backgroundColor: '#CCCCCC',
  },
  subtitleRow: {
    marginTop: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: '#888888',
  },
  tileContent: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  setupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeSelectGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeBox: {
    backgroundColor: '#F4F9F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2EFE2',
  },
  timeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222222',
  },
  switchGroup: {
    alignItems: 'center',
  },
  inputGroup: {
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#222222',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  testAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAFDF5',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  testAudioText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#06501A',
  },
  debugTranscriptBox: {
    marginTop: 16,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  debugTranscriptLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C757D',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  debugTranscriptText: {
    fontSize: 14,
    color: '#212529',
  },
  debugTranscriptItalic: {
    color: '#ADB5BD',
    fontStyle: 'italic',
  },
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999, // Ensure it sits on top of absolutely everything
    elevation: 9999,
  },
  alarmModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  stopButton: {
    backgroundColor: '#FFEBED',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  }
});
