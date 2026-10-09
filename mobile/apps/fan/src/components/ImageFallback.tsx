import React, { useState } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';
import { resolveAppImageUrl, FALLBACK_ARTWORK } from '../utils/imageUtils';

interface ImageFallbackProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackIconSize?: number;
  fallbackSource?: any;
}

export default function ImageFallback({
  source,
  style,
  fallbackIconSize = 24,
  fallbackSource = { uri: FALLBACK_ARTWORK },
  ...props
}: ImageFallbackProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const resolvedSource = React.useMemo(() => {
    if (source && typeof source === 'object' && 'uri' in source && typeof (source as any).uri === 'string') {
      return { ...source, uri: resolveAppImageUrl((source as any).uri, 'song') };
    }
    return source;
  }, [source]);

  React.useEffect(() => {
    setError(false);
    setLoading(true);
  }, [source]);

  return (
    <View style={[styles.container, style]}>
      {error ? (
        <Image
          source={fallbackSource}
          style={StyleSheet.absoluteFill}
          resizeMode={props.resizeMode || 'cover'}
        />
      ) : (
        <Image
          source={resolvedSource}
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
