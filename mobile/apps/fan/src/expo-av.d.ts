declare module 'expo-av' {
  import * as React from 'react';

  export type AVPlaybackStatus = {
    isLoaded: boolean;
    isPlaying?: boolean;
    positionMillis?: number;
    durationMillis?: number;
  };

  export const Audio: {
    setAudioModeAsync: (mode: any) => Promise<void>;
    Sound: {
      createAsync: (
        source: any,
        initialStatus?: any,
        onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void
      ) => Promise<{ sound: any; status: AVPlaybackStatus }>;
    };
  };

  export class Video extends React.Component<any> {
    getStatusAsync(): Promise<any>;
    playAsync(): Promise<any>;
    pauseAsync(): Promise<any>;
    stopAsync(): Promise<any>;
    unloadAsync(): Promise<any>;
    presentFullscreenPlayer(): Promise<any>;
    dismissFullscreenPlayer(): Promise<any>;
    setPositionAsync(positionMillis: number): Promise<any>;
    setStatusAsync(status: any): Promise<any>;
  }

  export const ResizeMode: {
    CONTAIN: any;
    COVER: any;
    STRETCH: any;
  };
}
