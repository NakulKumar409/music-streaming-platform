import { apiV1 } from './api';

export type ApiArtist = {
  id: string | number;
  name?: string | null;
  isVerified?: boolean;
  verified?: boolean;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  bio?: string | null;
  spotifyUrl?: string | null;
  youtubeUrl?: string | null;
  instagramUrl?: string | null;
  socialLinks?: {
    spotify?: string | null;
    youtube?: string | null;
    instagram?: string | null;
  } | null;
  subscriptionPrice?: number | string | null;
  status?: string | null;
  genre?: string | null;
};

export type ArtistListItem = {
  id: string;
  name: string;
  image: string;
  isVerified: boolean;
  subscriptionPrice: number;
  status: string;
  genre: string;
};

const FALLBACK_ARTIST_IMAGE =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80';

const HOST_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://music-streaming-platform-cvad.onrender.com';

function resolveImageUrl(url: string) {
  const trimmed = (url || '').toString().trim();
  if (!trimmed) return '';
  
  // Replace hardcoded localhost database entries with the current base URL
  if (trimmed.startsWith('http://localhost') || trimmed.startsWith('http://192.168.')) {
    const pathIndex = trimmed.indexOf('/', 8);
    if (pathIndex !== -1) {
      const path = trimmed.substring(pathIndex);
      return `${HOST_BASE_URL}${path}`;
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${HOST_BASE_URL}${trimmed}`;
  return trimmed;
}

export type ArtistDetail = {
  id: string;
  name: string;
  isVerified: boolean;
  profileImageUrl: string;
  coverImageUrl: string;
  bio: string;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  status: string;
  subscriptionPrice: number;
  genre: string;
};

function normalizeArtistId(raw: string): string {
  const s = (raw ?? '').toString().trim();
  if (!s) return '';
  const base = s.includes(':') ? s.split(':')[0] : s;
  const n = Number.parseInt(base, 10);
  if (!Number.isFinite(n) || n <= 0) return base;
  return String(n);
}

export async function fetchArtistById(artistId: string): Promise<ArtistDetail | null> {
  const id = normalizeArtistId((artistId || '').toString());
  if (!id) return null;
  const res = await apiV1.get(`/artists/${encodeURIComponent(id)}`);
  const a: ApiArtist | null = (res.data?.artist as any) ?? null;
  if (!a) return null;

  const subscriptionPrice = Number(a.subscriptionPrice ?? 0);
  const imageUrl =
    resolveImageUrl((a.coverImageUrl || a.profileImageUrl || '').toString()) || FALLBACK_ARTIST_IMAGE;

  const socials = (a.socialLinks ?? null) as any;
  const spotifyUrl = ((a.spotifyUrl ?? socials?.spotify) || null) ? String((a.spotifyUrl ?? socials?.spotify) as any) : null;
  const youtubeUrl = ((a.youtubeUrl ?? socials?.youtube) || null) ? String((a.youtubeUrl ?? socials?.youtube) as any) : null;
  const instagramUrl = ((a.instagramUrl ?? socials?.instagram) || null)
    ? String((a.instagramUrl ?? socials?.instagram) as any)
    : null;

  return {
    id: String(a.id),
    name: (a.name ?? 'Artist').toString(),
    isVerified: Boolean(a.isVerified ?? a.verified ?? false),
    profileImageUrl: resolveImageUrl((a.profileImageUrl || '').toString()) || imageUrl,
    coverImageUrl: imageUrl,
    bio: (a.bio ?? '').toString(),
    spotifyUrl,
    youtubeUrl,
    instagramUrl,
    status: (a.status ?? 'ACTIVE').toString(),
    subscriptionPrice: Number.isFinite(subscriptionPrice) ? subscriptionPrice : 0,
    genre: (a.genre ?? '').toString(),
  };
}

export type ApiArtistContentItem = {
  id: string | number;
  title?: string | null;
  type?: string | null;
  mediaType?: string | null;
  thumbnailUrl?: string | null;
  artwork?: string | null;
  mediaUrl?: string | null;
  fileUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  locked?: boolean;
  isLocked?: boolean;
  useStreamAccess?: boolean;
  createdAt?: string | null;
  created_at?: string | null;
};

export type ArtistMediaItem = {
  id: string;
  contentId?: string;
  title: string;
  mediaType: 'audio' | 'video';
  artworkUrl: string;
  mediaUrl: string;
  locked: boolean;
  useStreamAccess?: boolean;
  createdAt?: string | null;
};

function resolveMediaUrl(url: string) {
  return resolveImageUrl(url);
}

export async function fetchArtistMedia(artistId: string): Promise<ArtistMediaItem[]> {
  const id = normalizeArtistId((artistId || '').toString());
  if (!id) return [];
  const normalizedArtistId = String(id);

  let raw: ApiArtistContentItem[] = [];
  try {
    const url = `/content/artist/${encodeURIComponent(id)}`;
    console.log(`[DEBUG] fetchArtistMedia - hitting: ${apiV1.defaults.baseURL}${url}`);
    const res = await apiV1.get(url);
    raw = Array.isArray(res.data?.items)
      ? (res.data.items as any)
      : Array.isArray(res.data?.content)
        ? (res.data.content as any)
        : [];
  } catch {
    // Fallback to artist profile content route if fan content route fails.
    const res = await apiV1.get(`/artists/${encodeURIComponent(id)}/content`);
    raw = Array.isArray(res.data?.content)
      ? (res.data.content as any)
      : Array.isArray(res.data?.items)
        ? (res.data.items as any)
        : [];
  }

  if (!raw.length) {
    try {
      const res = await apiV1.get('/content');
      const feedItems = Array.isArray(res.data?.items) ? (res.data.items as any[]) : [];
      raw = feedItems.filter((it: any) => {
        const aId = normalizeArtistId(String(it?.artistId ?? it?.artist_id ?? ''));
        return aId === normalizedArtistId;
      });
    } catch {
      // no-op: preserve empty list
    }
  }

  const items: ArtistMediaItem[] = [];

  for (const it of raw) {
    const contentId = String(it.id);
    const title = (it.title ?? 'Untitled').toString();
    const artworkUrl =
      resolveMediaUrl((it.artwork || it.thumbnailUrl || '').toString()) ||
      'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

    const typeRaw = (it.mediaType || it.type || '').toString().toLowerCase();
    const isAudioVideo = typeRaw === 'audio_video' || typeRaw === 'audiovideo' || typeRaw === 'audio+video';
    const isVideoOnly = typeRaw === 'video';

    const audioUrl = resolveMediaUrl((it.audioUrl || '').toString()) || '';
    const videoUrl = resolveMediaUrl((it.videoUrl || '').toString()) || '';
    const fallbackUrl = resolveMediaUrl((it.mediaUrl || it.fileUrl || '').toString()) || '';
    // Some endpoints (notably /artists/:id/content) may omit direct media urls for
    // storage-backed uploads. In that case, force stream access so items still render
    // and playback URL is requested on demand.
    const useStreamAccess = Boolean(it.useStreamAccess) || (!audioUrl && !videoUrl && !fallbackUrl);

    const effectiveAudioUrl = audioUrl || (!isVideoOnly ? fallbackUrl : '');
    const effectiveVideoUrl = videoUrl || (isVideoOnly ? fallbackUrl : '');

    const createdAt = (it.createdAt || it.created_at || null) as string | null;

    if (isAudioVideo) {
      if (effectiveAudioUrl || useStreamAccess) {
        items.push({
          id: `${contentId}:audio`,
          contentId,
          title,
          mediaType: 'audio',
          artworkUrl,
          mediaUrl: effectiveAudioUrl,
          locked: false,
          useStreamAccess,
          createdAt,
        });
      }
      if (effectiveVideoUrl || useStreamAccess) {
        items.push({
          id: `${contentId}:video`,
          contentId,
          title,
          mediaType: 'video',
          artworkUrl,
          mediaUrl: effectiveVideoUrl,
          locked: false,
          useStreamAccess,
          createdAt,
        });
      }
      continue;
    }

    const mediaType: ArtistMediaItem['mediaType'] = isVideoOnly ? 'video' : 'audio';
    const mediaUrl = mediaType === 'video' ? effectiveVideoUrl : effectiveAudioUrl;
    if (!mediaUrl && !useStreamAccess) continue;

    items.push({
      id: contentId,
      contentId,
      title,
      mediaType,
      artworkUrl,
      mediaUrl,
      locked: false,
      useStreamAccess,
      createdAt,
    });
  }

  return items;
}

export async function fetchVerifiedArtists(): Promise<ArtistListItem[]> {
  const res = await apiV1.get('/artists');

  const raw: ApiArtist[] = Array.isArray(res.data?.artists)
    ? res.data.artists
    : Array.isArray(res.data?.items)
      ? res.data.items
      : [];

  return raw.map((a) => {
    const subscriptionPrice = Number(a.subscriptionPrice ?? 0);

    return {
      id: String(a.id),
      name: (a.name ?? 'Artist').toString(),
      image: resolveImageUrl((a.profileImageUrl || '').toString()) || FALLBACK_ARTIST_IMAGE,
      isVerified: Boolean(a.isVerified ?? a.verified ?? false),
      subscriptionPrice: Number.isFinite(subscriptionPrice) ? subscriptionPrice : 0,
      status: (a.status ?? 'ACTIVE').toString(),
      genre: (a.genre ?? '').toString(),
    };
  });
}
