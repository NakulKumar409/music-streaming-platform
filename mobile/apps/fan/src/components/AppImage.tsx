import React, { useState, useEffect } from 'react';
import {
  Image,
  ImageProps,
  ImageSourcePropType,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import {
  resolveAppImageUrl,
  FALLBACK_ARTWORK,
  FALLBACK_ARTIST_AVATAR,
  FALLBACK_BANNER,
} from '../utils/imageUtils';

const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const DEBUG_IMAGE_LOGS = false;

function appImgLog(label: string, data: Record<string, unknown>) {
  if (!DEBUG_IMAGE_LOGS) return;
  console.log('[AppImage][' + label + ']', data);
}

export interface AppImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  fallbackType?: 'song' | 'artist' | 'banner' | 'video';
  fallbackUri?: string;
  source?: ImageSourcePropType;
}

export default function AppImage({
  uri,
  fallbackType = 'song',
  fallbackUri,
  source,
  style,
  resizeMode = 'cover',
  ...props
}: AppImageProps) {
  const defaultFallback =
    fallbackUri ||
    (fallbackType === 'artist'
      ? FALLBACK_ARTIST_AVATAR
      : fallbackType === 'banner'
      ? FALLBACK_BANNER
      : FALLBACK_ARTWORK);

  const initialResolved = uri ? resolveAppImageUrl(uri, fallbackType) : defaultFallback;
  const [currentUri, setCurrentUri] = useState<string>(initialResolved);
  const [hasError, setHasError] = useState(false);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const resolved = uri ? resolveAppImageUrl(uri, fallbackType) : defaultFallback;
    setCurrentUri(resolved);
    setHasError(false);
    if (IS_DEV) {
      appImgLog('source-change', {
        platform: Platform.OS,
        uri: String(resolved).slice(0, 100),
        fallbackType,
      });
    }
  }, [uri, fallbackType, defaultFallback]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ w: width, h: height });
    if (props.onLayout) {
      props.onLayout(e);
    }
  };

  const handleLoad = (e: any) => {
    const nw = e?.nativeEvent?.width ?? e?.nativeEvent?.source?.width;
    const nh = e?.nativeEvent?.height ?? e?.nativeEvent?.source?.height;

    // Detect 1x1 dummy/pixel tracking responses and fallback
    if (nw === 1 && nh === 1) {
      if (!hasError && currentUri !== defaultFallback) {
        setHasError(true);
        setCurrentUri(defaultFallback);
      }
      return;
    }

    if (IS_DEV) {
      appImgLog('load-success', {
        platform: Platform.OS,
        uri: String(currentUri).slice(0, 100),
        sourceW: nw,
        sourceH: nh,
        containerW: containerSize?.w,
        containerH: containerSize?.h,
        resizeMode,
        fallbackUsed: hasError,
      });
    }
    if (props.onLoad) {
      props.onLoad(e);
    }
  };

  const handleError = (e: any) => {
    if (IS_DEV) {
      appImgLog('load-error', {
        platform: Platform.OS,
        uri: String(currentUri).slice(0, 100),
        error: String(e?.nativeEvent?.error ?? e?.message ?? 'unknown'),
        fallbackUsed: true,
      });
    }
    if (!hasError && currentUri !== defaultFallback) {
      setHasError(true);
      setCurrentUri(defaultFallback);
    }
    if (props.onError) {
      props.onError(e);
    }
  };

  const finalSource: ImageSourcePropType = source ? source : { uri: currentUri };
  const webStyle = Platform.OS === 'web' && resizeMode
    ? ({
        objectFit: (resizeMode === 'cover' || resizeMode === 'contain' || resizeMode === 'stretch')
          ? resizeMode
          : 'cover',
      } as any)
    : undefined;

  return (
    <Image
      source={finalSource}
      style={[style, webStyle]}
      resizeMode={resizeMode}
      onLayout={handleLayout}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
}
