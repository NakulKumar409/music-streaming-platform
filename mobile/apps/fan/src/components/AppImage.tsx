import React, { useState, useEffect } from 'react';
import { Image, ImageProps, ImageSourcePropType } from 'react-native';
import {
  resolveAppImageUrl,
  FALLBACK_ARTWORK,
  FALLBACK_ARTIST_AVATAR,
  FALLBACK_BANNER,
} from '../utils/imageUtils';

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

  useEffect(() => {
    const resolved = uri ? resolveAppImageUrl(uri, fallbackType) : defaultFallback;
    setCurrentUri(resolved);
    setHasError(false);
  }, [uri, fallbackType, defaultFallback]);

  const handleError = () => {
    if (!hasError && currentUri !== defaultFallback) {
      setHasError(true);
      setCurrentUri(defaultFallback);
    }
  };

  const finalSource: ImageSourcePropType = source ? source : { uri: currentUri };

  return (
    <Image
      source={finalSource}
      style={style}
      onError={handleError}
      {...props}
    />
  );
}
