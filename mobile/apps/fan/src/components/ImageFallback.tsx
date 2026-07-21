import React, { useState } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';

interface ImageFallbackProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackIconSize?: number;
}

export default function ImageFallback({ source, style, fallbackIconSize = 24, ...props }: ImageFallbackProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {error ? (
        <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
          <ImageIcon color={colors.textMuted} size={fallbackIconSize} />
        </View>
      ) : (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          {...props}
        />
      )}

      {loading && !error && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    position: 'relative',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
