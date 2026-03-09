import { apiV1 } from './api';

export type SubscribedArtist = {
  id: string;
  name: string;
  isVerified: boolean;
  profileImageUrl: string | null;
  status: string;
  genre: string;
};

export type RecentlyPlayedItem = {
  id: string;
  title: string;
  mediaType: 'audio' | 'video';
  artistId: string | null;
  artistName: string;
  artworkUrl: string | null;
  mediaUrl: string | null;
  useStreamAccess?: boolean;
  playedAt: string;
};

export async function fetchSubscribedArtists(): Promise<SubscribedArtist[]> {
  const res = await apiV1.get('/library/subscribed-artists');
  const raw = Array.isArray(res.data?.artists) ? res.data.artists : [];
  return raw.map((a: any) => ({
    id: String(a.id),
    name: (a.name ?? 'Artist').toString(),
    isVerified: Boolean(a.isVerified ?? a.verified ?? false),
    profileImageUrl: a.profileImageUrl ?? null,
    status: (a.status ?? 'ACTIVE').toString(),
    genre: (a.genre ?? '').toString(),
  }));
}

export async function fetchRecentlyPlayed(limit = 15): Promise<RecentlyPlayedItem[]> {
  const res = await apiV1.get('/library/recently-played', { params: { limit } });
  const raw = Array.isArray(res.data?.items) ? res.data.items : [];
  return raw.map((it: any) => ({
    id: String(it.id),
    title: (it.title ?? 'Untitled').toString(),
    mediaType: (it.mediaType ?? 'audio').toString().toLowerCase() === 'video' ? 'video' : 'audio',
    artistId: it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : null,
    artistName: (it.artistName ?? 'Artist').toString(),
    artworkUrl: it.artworkUrl ?? null,
    mediaUrl: it.mediaUrl ?? null,
    useStreamAccess: Boolean(it.useStreamAccess ?? (!it.mediaUrl && it.id)),
    playedAt: (it.playedAt ?? new Date().toISOString()).toString(),
  }));
}

export async function recordPlayback(songId: string): Promise<void> {
  const id = Number(songId);
  if (!Number.isFinite(id) || id <= 0) return;
  await apiV1.post('/library/playback', { songId: id });
}
