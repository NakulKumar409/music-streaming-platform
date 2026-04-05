import { apiV1 } from './api';

export type AudioQualityPref = 'HIGH' | 'DATA SAVER';

export type UserProfile = {
  name: string;
  fullName?: string;
  username?: string;
  bio?: string;
  favoriteGenre?: string;
  location?: string;
  isPremium: boolean;
  subscriptionCount: number;
  profileImageUrl?: string;
  pushNotifications: boolean;
  audioQuality: AudioQualityPref;
};

export type SubscriptionPlanSummary = {
  status: string;
  planType: string;
  endDate: string | null;
  artistId: string | null;
  artistName?: string;
};

export type Transaction = {
  id: string;
  amount: number;
  artistName: string;
  date: string;
  status?: string;
};

export type ListenTime = {
  totalMinutes: number;
  formattedTime: string;
};

export type UpdateProfileInput = {
  fullName?: string;
  username?: string;
  bio?: string;
  favoriteGenre?: string;
  location?: string;
};

export type UpdatePasswordInput = {
  oldPassword?: string;
  newPassword?: string;
};

export type UpdateSettingsInput = {
  pushNotifications?: boolean;
  audioQuality?: AudioQualityPref;
};

export interface UserService {
  getUserProfile(): Promise<UserProfile>;
  getTransactions(): Promise<Transaction[]>;
  getListenTime(): Promise<ListenTime>;
  getSubscriptionPlanSummary(): Promise<SubscriptionPlanSummary | null>;
  updateProfile(input: UpdateProfileInput): Promise<any>;
  updatePassword(input: UpdatePasswordInput): Promise<any>;
  uploadProfileImage(uri: string, mimeType: string, fileName: string): Promise<string>;
  updateSettings(input: UpdateSettingsInput): Promise<any>;
}

export const userService: UserService = {
  async getUserProfile() {
    const res = await apiV1.get('/user/profile');
    const profile = res.data?.profile ?? {};
    const premium = res.data?.premium ?? {};
    return {
      name: (profile.name || profile.fullName || profile.full_name || '').toString(),
      fullName: (profile.fullName || profile.full_name || '').toString(),
      username: (profile.username || '').toString(),
      bio: (profile.bio || '').toString(),
      favoriteGenre: (profile.favoriteGenre || profile.favorite_genre || '').toString(),
      location: (profile.location || '').toString(),
      profileImageUrl: (profile.profileImageUrl || profile.profile_image_url || '').toString(),
      isPremium: Boolean(premium.isPremium ?? false),
      subscriptionCount: Number(premium.subscriptionCount ?? 0),
      pushNotifications: Boolean(profile.notificationsPref ?? true),
      audioQuality: (profile.audioQualityPref || 'HIGH') as AudioQualityPref,
    };
  },

  async getTransactions() {
    const res = await apiV1.get('/user/transactions');
    const raw = Array.isArray(res.data?.transactions) ? res.data.transactions : [];
    return raw.map((tx: any) => ({
      id: String(tx.id),
      amount: Number(tx.amount ?? 0),
      artistName: (tx.artistName ?? tx.artist_name ?? '').toString(),
      date: (tx.date ?? '').toString(),
      status: (tx.status ?? '').toString(),
    }));
  },

  async getListenTime() {
    // Backend does not currently expose listen-time; keep a safe default.
    return { totalMinutes: 0, formattedTime: '—' };
  },

  async getSubscriptionPlanSummary() {
    const res = await apiV1.get('/subscriptions/summary');
    const plan = res.data?.plan ?? null;
    if (!plan) return null;
    return {
      status: (plan.status ?? '').toString(),
      planType: (plan.plan_type ?? plan.planType ?? '').toString() || 'MONTHLY',
      endDate: plan.end_date ? String(plan.end_date) : null,
      artistId: plan.artist_id !== undefined && plan.artist_id !== null ? String(plan.artist_id) : null,
      artistName: (plan.artist_name || '').toString(),
    };
  },

  async updateProfile(input: UpdateProfileInput) {
    const res = await apiV1.put('/user/update', input);
    return res.data?.profile;
  },

  async updatePassword(input: UpdatePasswordInput) {
    const res = await apiV1.put('/user/update-password', input);
    return res.data;
  },

  async uploadProfileImage(uri: string, mimeType: string, fileName: string) {
    const formData = new FormData();
    formData.append('image', {
      uri,
      type: mimeType,
      name: fileName,
    } as any);

    const res = await apiV1.post('/user/profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data?.profileImageUrl;
  },

  async updateSettings(input: UpdateSettingsInput) {
    const res = await apiV1.put('/user/settings', {
      pushNotifications: input.pushNotifications,
      audioQualityPref: input.audioQuality,
    });
    return res.data;
  },
};
