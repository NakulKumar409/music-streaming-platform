import { apiV1 } from './api';

export type ApiArtist = {
  id: string | number;
  name?: string | null;
  isVerified?: boolean;
  verified?: boolean;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
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

const HOST_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

function resolveImageUrl(url: string) {
  const trimmed = (url || '').toString().trim();
  if (!trimmed) return '';
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
  status: string;
  subscriptionPrice: number;
  genre: string;
};

export async function fetchArtistById(artistId: string): Promise<ArtistDetail | null> {
  const id = (artistId || '').toString();
  if (!id) return null;
  const res = await apiV1.get(`/artists/${encodeURIComponent(id)}`);
  const a: ApiArtist | null = (res.data?.artist as any) ?? null;
  if (!a) return null;

  const subscriptionPrice = Number(a.subscriptionPrice ?? 0);
  const imageUrl =
    resolveImageUrl((a.coverImageUrl || a.profileImageUrl || '').toString()) || FALLBACK_ARTIST_IMAGE;

  return {
    id: String(a.id),
    name: (a.name ?? 'Artist').toString(),
    isVerified: Boolean(a.isVerified ?? a.verified ?? false),
    profileImageUrl: resolveImageUrl((a.profileImageUrl || '').toString()) || imageUrl,
    coverImageUrl: imageUrl,
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
  locked?: boolean;
  isLocked?: boolean;
  useStreamAccess?: boolean;
};

export type ArtistMediaItem = {
  id: string;
  title: string;
  mediaType: 'audio' | 'video';
  artworkUrl: string;
  mediaUrl: string;
  locked: boolean;
  useStreamAccess?: boolean;
};

function resolveMediaUrl(url: string) {
  return resolveImageUrl(url);
}

export async function fetchArtistMedia(artistId: string): Promise<ArtistMediaItem[]> {
  const id = (artistId || '').toString();
  if (!id) return [];

  const res = await apiV1.get(`/content/artist/${encodeURIComponent(id)}`);
  const raw: ApiArtistContentItem[] = Array.isArray(res.data?.items) ? res.data.items : [];

  return raw
    .map((it) => {
      const mediaTypeRaw = (it.mediaType || it.type || '').toString().toLowerCase();
      const isVideoCapable = mediaTypeRaw === 'video' || mediaTypeRaw === 'audio_video' || mediaTypeRaw === 'audiovideo';
      const mediaType: ArtistMediaItem['mediaType'] = isVideoCapable ? 'video' : 'audio';
      const artworkUrl =
        resolveMediaUrl((it.artwork || it.thumbnailUrl || '').toString()) ||
        'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';
      const mediaUrl = resolveMediaUrl((it.mediaUrl || it.fileUrl || '').toString()) || '';
      const useStreamAccess = Boolean(it.useStreamAccess);
      const item: ArtistMediaItem = {
        id: String(it.id),
        title: (it.title ?? 'Untitled').toString(),
        mediaType,
        artworkUrl,
        mediaUrl,
        locked: false,
        useStreamAccess,
      };

      return item;
    })
    .filter((it) => Boolean(it.mediaUrl) || it.useStreamAccess);
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
