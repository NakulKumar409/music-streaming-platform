import React, { useState } from 'react';
import {
  Image,
  ImageProps,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';

// ─── Dev diagnostic logger ────────────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV !== 'production';

function imgLog(label: string, data: Record<string, unknown>) {
  if (!IS_DEV) return;
  console.log('[ImageFallback][' + label + ']', data);
}
// ──────────────────────────────────────────────────────────────────────────────

interface ImageFallbackProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackIconSize?: number;
  fallbackSource?: any;
}

export default function ImageFallback({
  source,
  style,
  fallbackIconSize = 24,
  fallbackSource,
  resizeMode = 'cover',
  ...props
}: ImageFallbackProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  /**
   * IMPORTANT: Do NOT call resolveAppImageUrl here.
   * Every caller (MusicCard, VideoCard, ArtistCard, LockedContentCard,
   * HeroCarousel) already resolves the URL before constructing the source prop.
   * Double-resolution corrupts Cloudinary transformation strings.
   */
  const resolvedSource = React.useMemo(() => {
    if (source && typeof source === 'object' && 'uri' in source) {
      const rawUri = ((source as any).uri ?? '').toString().trim();
      if (!rawUri) return null;
      return source; // pass-through — caller already resolved
    }
    return source;
  }, [source]);

  React.useEffect(() => {
    setError(false);
    setLoading(true);
    if (IS_DEV) {
      const uri =
        resolvedSource && typeof resolvedSource === 'object' && 'uri' in resolvedSource
          ? (resolvedSource as any).uri
          : '(static/null)';
      imgLog('source-change', { platform: Platform.OS, uri: String(uri).slice(0, 120) });
    }
  }, [source]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ w: width, h: height });
    if (IS_DEV) {
      const uri =
        resolvedSource && typeof resolvedSource === 'object' && 'uri' in resolvedSource
          ? (resolvedSource as any).uri
          : '(static)';
      imgLog('container-layout', {
        platform: Platform.OS,
        containerW: Math.round(width),
        containerH: Math.round(height),
        uri: String(uri).slice(0, 80),
      });
    }
  };

  const handleLoad = (e: any) => {
    const nw: number | undefined =
      e?.nativeEvent?.width ?? e?.nativeEvent?.source?.width;
    const nh: number | undefined =
      e?.nativeEvent?.height ?? e?.nativeEvent?.source?.height;

    if (nw === 1 && nh === 1) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(false);
    if (IS_DEV) {
      const uri =
        resolvedSource && typeof resolvedSource === 'object' && 'uri' in resolvedSource
          ? (resolvedSource as any).uri
          : '(static)';
      imgLog('load-success', {
        platform: Platform.OS,
        uri: String(uri).slice(0, 120),
        sourceW: nw,
        sourceH: nh,
        sourceAspect: nw && nh ? (nw / nh).toFixed(2) : null,
        containerW: containerSize?.w,
        containerH: containerSize?.h,
        resizeMode,
        fallbackUsed: false,
      });
    }
  };

  const handleError = (e: any) => {
    setLoading(false);
    setError(true);
    if (IS_DEV) {
      const uri =
        resolvedSource && typeof resolvedSource === 'object' && 'uri' in resolvedSource
          ? (resolvedSource as any).uri
          : '(static)';
      imgLog('load-error', {
        platform: Platform.OS,
        uri: String(uri).slice(0, 120),
        error: String(e?.nativeEvent?.error ?? e?.message ?? 'unknown'),
        fallbackUsed: true,
      });
    }
  };

  /**
   * Image fill strategy — cross-platform fix:
   *
   * The outer <View> (this component root, `style` prop applied) is the clipping
   * container. It MUST receive explicit pixel dimensions or aspectRatio from the
   * parent layout. The <Image> inside is positioned absolutely so it always fills
   * the container regardless of platform.
   *
   * On Expo Web, `resizeMode` on <Image> maps to `object-fit` via Expo's web
   * layer. We explicitly set `objectFit` via the style prop as well to guarantee
   * the correct CSS value regardless of bundler version.
   *
   * NOTE: Do NOT combine StyleSheet.absoluteFillObject with percentage
   * width/height. absoluteFillObject already anchors all four edges to 0.
   * Adding percentage sizes creates a conflicting double-constraint that causes
   * platform-specific black bars and sizing anomalies.
   */
  const webObjectFitStyle = Platform.OS === 'web'
    ? {
        objectFit: (resizeMode === 'cover' || resizeMode === 'contain' || resizeMode === 'stretch')
          ? resizeMode
          : 'cover',
      } as any
    : undefined;

  const imgStyle = [styles.imageAbsoluteFill, webObjectFitStyle];

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {error || !resolvedSource ? (
        fallbackSource ? (
          <Image
            source={fallbackSource}
            style={imgStyle}
            resizeMode={resizeMode}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
            <ImageIcon color="rgba(255, 255, 255, 0.15)" size={fallbackIconSize} />
          </View>
        )
      ) : (
        <Image
          source={resolvedSource as any}
          style={imgStyle}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
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
    backgroundColor: '#0f0f1a',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * Use absoluteFillObject alone — this pins all four edges to 0.
   * Do NOT add width/height: '100%' — this creates a conflict with the
   * absolutePosition and causes black-bar rendering bugs on Android and web.
   */
  imageAbsoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
