import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import TrackPlayer, {
  State,
  Event,
  useTrackPlayerEvents,
  usePlaybackState,
  useProgress,
  useActiveTrack,
} from 'react-native-track-player';
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Music } from 'lucide-react-native';

/**
 * Background Playback Test Screen
 * 
 * Use this screen to verify background playback, lock screen controls,
 * notification panel controls, and state synchronization.
 * 
 * INSTRUCTIONS:
 * 1. Navigate to this screen in the app
 * 2. Tap "Load Test Track" 
 * 3. Tap "Play"
 * 4. Minimize app / Lock screen / Open notification panel
 * 5. Check logs and status indicators below
 * 6. Test all remote controls
 */

const TEST_TRACK = {
  id: 'test-audio-1',
  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  title: 'Test Audio Track',
  artist: 'Background Playback Test',
  artwork: 'https://via.placeholder.com/500x500/000000/FFFFFF?text=Test+Track',
  duration: 372, // 6:12
};

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
}

export default function BackgroundPlaybackTestScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isTrackLoaded, setIsTrackLoaded] = useState(false);
  const [remoteEvents, setRemoteEvents] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // TrackPlayer hooks
  const playbackState = usePlaybackState();
  const progress = useProgress(1000); // Update every 1 second
  const activeTrack = useActiveTrack();

  // Logger function
  const log = (message: string, level: LogEntry['level'] = 'info', source = 'Test') => {
    const timestamp = new Date().toLocaleTimeString();
    const entry: LogEntry = { timestamp, level, message, source };
    setLogs(prev => [...prev, entry]);
    
    // Also log to console for adb logcat capture
    const consoleMessage = `[${source}] ${message}`;
    if (level === 'error') console.error(consoleMessage);
    else if (level === 'warn') console.warn(consoleMessage);
    else console.log(consoleMessage);
  };

  // Auto-scroll logs
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [logs]);

  // App state monitoring
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
      log(`App state changed to: ${nextAppState}`, 'info', 'AppState');
    });

    return () => subscription.remove();
  }, []);

  // TrackPlayer events monitoring
  useTrackPlayerEvents([
    Event.RemotePlay,
    Event.RemotePause,
    Event.RemoteNext,
    Event.RemotePrevious,
    Event.RemoteSeek,
    Event.RemoteJumpForward,
    Event.RemoteJumpBackward,
    Event.RemoteStop,
    Event.RemoteDuck,
    Event.PlaybackState,
    Event.PlaybackTrackChanged,
    Event.PlaybackError,
    Event.PlaybackQueueEnded,
  ], (event) => {
    log(`Event: ${event.type}`, 'success', 'TrackPlayer');
    setRemoteEvents(prev => [...prev, event.type].slice(-10)); // Keep last 10

    if (event.type === Event.RemotePlay) {
      log('REMOTE PLAY triggered from lock screen/notification', 'success', 'RemoteControl');
    }
    if (event.type === Event.RemotePause) {
      log('REMOTE PAUSE triggered from lock screen/notification', 'success', 'RemoteControl');
    }
    if (event.type === Event.RemoteNext) {
      log('REMOTE NEXT triggered from lock screen/notification', 'success', 'RemoteControl');
    }
    if (event.type === Event.RemotePrevious) {
      log('REMOTE PREVIOUS triggered from lock screen/notification', 'success', 'RemoteControl');
    }
    if (event.type === Event.RemoteSeek) {
      log(`REMOTE SEEK to ${event.position}s`, 'success', 'RemoteControl');
    }
    if (event.type === Event.RemoteDuck) {
      log(`Audio ducking: ${event.permanent ? 'PERMANENT' : 'TEMPORARY'}`, event.permanent ? 'warn' : 'info', 'AudioFocus');
    }
    if (event.type === Event.PlaybackError) {
      log(`Playback Error: ${event.message || 'Unknown'}`, 'error', 'TrackPlayer');
    }
  });

  // Load test track
  const loadTestTrack = async () => {
    try {
      log('Loading test track...', 'info', 'Test');
      await TrackPlayer.reset();
      await TrackPlayer.add(TEST_TRACK);
      setIsTrackLoaded(true);
      log('Test track loaded successfully', 'success', 'Test');
      log(`Track: ${TEST_TRACK.title} by ${TEST_TRACK.artist}`, 'info', 'Test');
    } catch (error) {
      log(`Failed to load track: ${error}`, 'error', 'Test');
    }
  };

  // Play/Pause
  const togglePlayPause = async () => {
    try {
      if (!isTrackLoaded) {
        await loadTestTrack();
      }

      if (playbackState.state === State.Playing) {
        await TrackPlayer.pause();
        log('Playback paused from app', 'info', 'AppControl');
      } else {
        await TrackPlayer.play();
        log('Playback started from app', 'info', 'AppControl');
      }
    } catch (error) {
      log(`Play/Pause error: ${error}`, 'error', 'AppControl');
    }
  };

  // Skip forward 10 seconds
  const skipForward = async () => {
    try {
      const newPosition = progress.position + 10;
      await TrackPlayer.seekTo(newPosition);
      log(`Skipped forward to ${Math.floor(newPosition)}s`, 'info', 'AppControl');
    } catch (error) {
      log(`Skip error: ${error}`, 'error', 'AppControl');
    }
  };

  // Skip backward 10 seconds
  const skipBackward = async () => {
    try {
      const newPosition = Math.max(0, progress.position - 10);
      await TrackPlayer.seekTo(newPosition);
      log(`Skipped backward to ${Math.floor(newPosition)}s`, 'info', 'AppControl');
    } catch (error) {
      log(`Skip error: ${error}`, 'error', 'AppControl');
    }
  };

  // Reset everything
  const resetPlayback = async () => {
    try {
      await TrackPlayer.reset();
      setIsTrackLoaded(false);
      setRemoteEvents([]);
      log('Playback reset', 'info', 'Test');
    } catch (error) {
      log(`Reset error: ${error}`, 'error', 'Test');
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    log('Logs cleared', 'info', 'Test');
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (playbackState.state) {
      case State.Playing: return '#4CAF50'; // Green
      case State.Paused: return '#FFC107'; // Yellow
      case State.Buffering: return '#2196F3'; // Blue
      case State.Error: return '#F44336'; // Red
      default: return '#9E9E9E'; // Gray
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Background Playback Test</Text>
        <Text style={styles.subtitle}>Real Device Verification Screen</Text>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>TEST PROCEDURE:</Text>
          <Text style={styles.instruction}>1. Tap "Load Test Track" button</Text>
          <Text style={styles.instruction}>2. Tap Play button</Text>
          <Text style={styles.instruction}>3. Minimize app → Audio should continue</Text>
          <Text style={styles.instruction}>4. Lock screen → Check controls visible</Text>
          <Text style={styles.instruction}>5. Test remote controls (lock/notification)</Text>
          <Text style={styles.instruction}>6. Watch logs below for events</Text>
        </View>

        {/* Current Track Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Track</Text>
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle}>{activeTrack?.title || 'No Track'}</Text>
            <Text style={styles.trackArtist}>{activeTrack?.artist || 'Unknown Artist'}</Text>
          </View>
        </View>

        {/* Playback Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playback Status</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>
              {playbackState.state === State.Playing ? 'PLAYING' : 
               playbackState.state === State.Paused ? 'PAUSED' :
               playbackState.state === State.Buffering ? 'BUFFERING' :
               playbackState.state === State.None ? 'IDLE' :
               playbackState.state === State.Error ? 'ERROR' : 'UNKNOWN'}
            </Text>
          </View>
          <Text style={styles.progressText}>
            Position: {formatTime(progress.position)} / {formatTime(progress.duration)}
          </Text>
          <Text style={styles.appStateText}>App State: {appState}</Text>
        </View>

        {/* Remote Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Remote Events</Text>
          {remoteEvents.length === 0 ? (
            <Text style={styles.noEvents}>No remote events yet</Text>
          ) : (
            remoteEvents.map((event, index) => (
              <Text key={index} style={styles.eventItem}>• {event}</Text>
            ))
          )}
        </View>

        {/* Controls */}
        <View style={styles.controlsSection}>
          <TouchableOpacity style={styles.button} onPress={loadTestTrack}>
            <Music size={20} color="#fff" />
            <Text style={styles.buttonText}>Load Test Track</Text>
          </TouchableOpacity>

          <View style={styles.playbackControls}>
            <TouchableOpacity style={styles.controlButton} onPress={skipBackward}>
              <SkipBack size={28} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.controlButton, styles.playButton]} onPress={togglePlayPause}>
              {playbackState.state === State.Playing ? (
                <Pause size={32} color="#fff" />
              ) : (
                <Play size={32} color="#fff" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={skipForward}>
              <SkipForward size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={resetPlayback}>
            <RefreshCw size={20} color="#fff" />
            <Text style={styles.buttonText}>Reset Playback</Text>
          </TouchableOpacity>
        </View>

        {/* Logs */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Event Logs</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          {logs.length === 0 ? (
            <Text style={styles.noLogs}>No logs yet. Interact with the player to see events.</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text style={[styles.logSource, { 
                  color: log.level === 'error' ? '#F44336' : 
                         log.level === 'warn' ? '#FF9800' :
                         log.level === 'success' ? '#4CAF50' : '#64B5F6'
                }]}>
                  [{log.source}]
                </Text>
                <Text style={styles.logMessage}>{log.message}</Text>
              </View>
            ))
          )}
        </View>

        {/* Verification Checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Checklist</Text>
          <Text style={styles.checklistItem}>□ Background playback continues when minimized</Text>
          <Text style={styles.checklistItem}>□ Audio continues when screen off</Text>
          <Text style={styles.checklistItem}>□ Lock screen shows track info</Text>
          <Text style={styles.checklistItem}>□ Lock screen controls work (Play/Pause)</Text>
          <Text style={styles.checklistItem}>□ Lock screen controls work (Next/Prev)</Text>
          <Text style={styles.checklistItem}>□ Notification panel shows media player (Android)</Text>
          <Text style={styles.checklistItem}>□ Control Center shows media (iOS)</Text>
          <Text style={styles.checklistItem}>□ State syncs from remote → app</Text>
          <Text style={styles.checklistItem}>□ State syncs from app → remote</Text>
        </View>

        {/* Log Capture Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Capture Commands</Text>
          <Text style={styles.codeBlock}>
            {Platform.OS === 'android' 
              ? 'adb logcat | grep -E "TrackPlayer|PlaybackService|MediaPlayer|RemoteControl"'
              : 'xcrun simctl spawn booted log stream --predicate \'eventMessage CONTAINS "TrackPlayer" OR eventMessage CONTAINS "Audio"\''}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructions: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#64B5F6',
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64B5F6',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 4,
  },
  section: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  trackInfo: {
    alignItems: 'center',
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  trackArtist: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  appStateText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  noEvents: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  eventItem: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 2,
  },
  controlsSection: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#64B5F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#64B5F6',
  },
  resetButton: {
    backgroundColor: '#F44336',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: '#64B5F6',
    fontSize: 14,
  },
  noLogs: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logEntry: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    paddingVertical: 2,
  },
  logTime: {
    fontSize: 10,
    color: '#666',
    marginRight: 8,
    width: 70,
  },
  logSource: {
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 8,
    width: 90,
  },
  logMessage: {
    fontSize: 11,
    color: '#ccc',
    flex: 1,
  },
  checklistItem: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 6,
  },
  codeBlock: {
    backgroundColor: '#0D0D0D',
    padding: 12,
    borderRadius: 4,
    fontSize: 11,
    color: '#4CAF50',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
