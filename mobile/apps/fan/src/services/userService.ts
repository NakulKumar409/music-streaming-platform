import { apiV1 } from './api';

export type AudioQualityPref = 'HIGH' | 'DATA SAVER';

export type UserProfile = {
  name: string;
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
  name?: string;
  profileImageUrl?: string;
  password?: string;
};

export type UpdateSettingsInput = {
  pushNotifications?: boolean;
  audioQuality?: AudioQualityPref;
};

export interface UserService {
  getUserProfile(): Promise<Pick<UserProfile, 'name' | 'isPremium' | 'subscriptionCount'>>;
  getTransactions(): Promise<Transaction[]>;
  getListenTime(): Promise<ListenTime>;
  getSubscriptionPlanSummary(): Promise<SubscriptionPlanSummary | null>;
  updateProfile(input: UpdateProfileInput): Promise<UserProfile>;
  updateSettings(input: UpdateSettingsInput): Promise<UserProfile>;
}

export const userService: UserService = {
  async getUserProfile() {
    const res = await apiV1.get('/user/profile');
    const profile = res.data?.profile ?? {};
    const premium = res.data?.premium ?? {};
    return {
      name: (profile.name ?? '').toString(),
      isPremium: Boolean(premium.isPremium ?? false),
      subscriptionCount: Number(premium.subscriptionCount ?? 0),
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
    };
  },

  async updateProfile(input: UpdateProfileInput) {
    // Not implemented on backend yet.
    return {
      name: (input.name ?? 'User').toString(),
      isPremium: false,
      subscriptionCount: 0,
      pushNotifications: true,
      audioQuality: 'HIGH',
      profileImageUrl: input.profileImageUrl ?? '',
    };
  },

  async updateSettings(input: UpdateSettingsInput) {
    // Not implemented on backend yet.
    return {
      name: 'User',
      isPremium: false,
      subscriptionCount: 0,
      pushNotifications: input.pushNotifications ?? true,
      audioQuality: input.audioQuality ?? 'HIGH',
      profileImageUrl: '',
    };
  },
};
