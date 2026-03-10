export type MediaType = 'audio' | 'video';

export type MediaItem = {
  id: string;
  contentId?: string;
  title: string;
  artistName?: string;
  artistId?: string;
  mediaType: MediaType;
  artworkUrl?: string | null;
  mediaUrl: string | null;
  isLocked?: boolean;
  /** When true, resolve playback URL via POST /stream/access before playing */
  useStreamAccess?: boolean;
};

export type PlayerState = {
  queue: MediaItem[];
  currentIndex: number;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isExpanded: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'one' | 'all';
  playbackRate: number;
  volume: number;
};
