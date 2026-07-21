import { ImageSourcePropType } from 'react-native';

export type HeroSlide = {
  id: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
};

export type Artist = {
  id: string;
  name: string;
  image: ImageSourcePropType;
  subscriberCount: string;
  isVerified: boolean;
};

export type AudioTrack = {
  id: string;
  title: string;
  artistName: string;
  artwork: ImageSourcePropType;
  duration: string;
  badge?: 'EARLY_ACCESS' | 'PREMIUM' | 'NEW';
};

export type ExclusiveContent = {
  id: string;
  title: string;
  artistName: string;
  artwork: ImageSourcePropType;
  badge: 'EARLY_ACCESS' | 'PREMIUM' | 'NEW';
};

export type MusicVideo = {
  id: string;
  title: string;
  artistName: string;
  thumbnail: ImageSourcePropType;
  duration: string;
  viewCount: string;
};

export type Benefit = {
  id: string;
  title: string;
  description: string;
  iconName: string;
};

export const heroSlides: HeroSlide[] = [
  {
    id: 'hero-1',
    title: 'Feel Every Beat',
    description: 'Stream exclusive audio and music videos from the artists you love.',
    image: { uri: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80' },
  },
  {
    id: 'hero-2',
    title: 'Discover Exclusive Releases',
    description: 'Listen to new music before everyone else.',
    image: { uri: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80' },
  },
  {
    id: 'hero-3',
    title: 'Support Your Favourite Artists',
    description: 'Subscribe directly and unlock premium content.',
    image: { uri: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80' },
  },
];

export const trendingArtists: Artist[] = [
  {
    id: 'art-1',
    name: 'Arijit Singh',
    subscriberCount: '2.3M subscribers',
    image: { uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80' },
    isVerified: true,
  },
  {
    id: 'art-2',
    name: 'Shreya Ghoshal',
    subscriberCount: '1.8M subscribers',
    image: { uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80' },
    isVerified: true,
  },
  {
    id: 'art-3',
    name: 'Divine',
    subscriberCount: '1.2M subscribers',
    image: { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80' },
    isVerified: true,
  },
  {
    id: 'art-4',
    name: 'Neha Kakkar',
    subscriberCount: '1.1M subscribers',
    image: { uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80' },
    isVerified: true,
  },
  {
    id: 'art-5',
    name: 'Indie Beats',
    subscriberCount: '986K subscribers',
    image: { uri: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=300&q=80' },
    isVerified: true,
  },
];

export const popularTracks: AudioTrack[] = [
  {
    id: 'track-1',
    title: 'Midnight Echoes',
    artistName: 'Arijit Singh',
    duration: '03:45',
    artwork: { uri: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80' },
  },
  {
    id: 'track-2',
    title: 'Broken Strings',
    artistName: 'Shreya Ghoshal',
    duration: '04:12',
    badge: 'EARLY_ACCESS',
    artwork: { uri: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=300&q=80' },
  },
  {
    id: 'track-3',
    title: 'City Lights',
    artistName: 'Divine',
    duration: '03:28',
    artwork: { uri: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80' },
  },
  {
    id: 'track-4',
    title: 'Lost in You',
    artistName: 'Neha Kakkar',
    duration: '04:05',
    artwork: { uri: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80' },
  },
  {
    id: 'track-5',
    title: 'Fading Stars',
    artistName: 'Indie Beats',
    duration: '03:50',
    badge: 'NEW',
    artwork: { uri: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=300&q=80' },
  },
];

export const lockedContent: ExclusiveContent[] = [
  {
    id: 'lock-1',
    title: 'Silhouettes',
    artistName: 'Arijit Singh',
    badge: 'NEW',
    artwork: { uri: 'https://images.unsplash.com/photo-1487180142328-0c4e37023af5?auto=format&fit=crop&w=300&q=80' },
  },
  {
    id: 'lock-2',
    title: 'Unspoken Words',
    artistName: 'Shreya Ghoshal',
    badge: 'EARLY_ACCESS',
    artwork: { uri: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&q=80' },
  },
  {
    id: 'lock-3',
    title: 'No Regrets',
    artistName: 'Divine',
    badge: 'PREMIUM',
    artwork: { uri: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80' },
  },
];

export const latestVideos: MusicVideo[] = [
  {
    id: 'vid-1',
    title: 'Hawa Banke',
    artistName: 'Arijit Singh',
    duration: '04:32',
    viewCount: '2.1M views',
    thumbnail: { uri: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=500&q=80' },
  },
  {
    id: 'vid-2',
    title: 'Teri Ore',
    artistName: 'Shreya Ghoshal',
    duration: '03:58',
    viewCount: '1.6M views',
    thumbnail: { uri: 'https://images.unsplash.com/photo-1482440308425-276ad0f28b19?auto=format&fit=crop&w=500&q=80' },
  },
  {
    id: 'vid-3',
    title: 'Punya Paap',
    artistName: 'Divine',
    duration: '03:27',
    viewCount: '1.3M views',
    thumbnail: { uri: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=500&q=80' },
  },
  {
    id: 'vid-4',
    title: 'Khwaab',
    artistName: 'Neha Kakkar',
    duration: '04:01',
    viewCount: '1.2M views',
    thumbnail: { uri: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=500&q=80' },
  },
  {
    id: 'vid-5',
    title: 'Sunset Drive',
    artistName: 'Indie Beats',
    duration: '03:48',
    viewCount: '920K views',
    thumbnail: { uri: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=500&q=80' },
  },
];

export const benefits: Benefit[] = [
  {
    id: 'ben-1',
    title: 'Unlimited Streaming',
    description: 'Listen to music anytime, anywhere.',
    iconName: 'Music',
  },
  {
    id: 'ben-2',
    title: 'Exclusive Releases',
    description: 'Get early access to premium content.',
    iconName: 'Sparkles',
  },
  {
    id: 'ben-3',
    title: 'Support Artists',
    description: 'Subscribe directly and support your favourites.',
    iconName: 'Heart',
  },
  {
    id: 'ben-4',
    title: 'Audio & Video',
    description: 'Enjoy songs and music videos in one place.',
    iconName: 'PlayCircle',
  },
];
