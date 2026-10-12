import React, { useState } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
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
  fallbackSource,
  resizeMode = 'contain',
  ...props
}: ImageFallbackProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const resolvedSource = React.useMemo(() => {
    if (source && typeof source === 'object' && 'uri' in source && typeof (source as any).uri === 'string') {
      const rawUri = (source as any).uri.trim();
      if (!rawUri) return null;
      return { ...source, uri: resolveAppImageUrl(rawUri, 'song') };
    }
    return source;
  }, [source]);

  React.useEffect(() => {
    setError(false);
    setLoading(true);
  }, [source]);

  const imageStyle = [
    StyleSheet.absoluteFillObject,
    { width: '100%', height: '100%' },
    Platform.OS === 'web' ? ({ objectFit: resizeMode } as any) : undefined,
  ];

  return (
    <View style={[styles.container, style]}>
      {error || !resolvedSource ? (
        fallbackSource ? (
          <Image
            source={fallbackSource}
            style={imageStyle}
            resizeMode={resizeMode}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
            <ImageIcon color="rgba(255, 255, 255, 0.15)" size={fallbackIconSize} />
          </View>
        )
      ) : (
        <Image
          source={resolvedSource}
          style={imageStyle}
          resizeMode={resizeMode}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          {...props}
        />
      )}

      {loading && !error && resolvedSource && (
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
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
