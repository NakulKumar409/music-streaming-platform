import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Wifi } from 'lucide-react-native';
import { Colors } from '../theme';

const OfflineScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Wifi size={64} color="#6B7280" />
        </View>

        <Text style={styles.title}>No Internet Connection</Text>
        <Text style={styles.subtitle}>
          Please check your internet connection and try again.
        </Text>

        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F0F0F',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
    maxWidth: 360,
  },
  iconContainer: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  retryButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent || '#FFB800',
    paddingVertical: 14,
    borderRadius: 24,
    elevation: 4,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default OfflineScreen;

