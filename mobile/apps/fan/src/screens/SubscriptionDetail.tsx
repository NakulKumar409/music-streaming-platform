import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw, Crown, Award, BadgeCheck, AlertTriangle, FileText } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ErrorBoundary from '../ui/ErrorBoundary';
import { userService, SubscriptionRecord, Transaction } from '../services/userService';
import { TransactionRow, AutoRenewToggle, CancellationFlow } from '../ui/SubscriptionUI';

type SubData = {
  type: 'ARTIST' | 'PLATFORM';
  status: string;
  plan_type: string;
  start_date: string | null;
  end_date: string | null;
  next_billing_date: string | null;
  grace_ends_at: string | null;
  auto_renew: boolean;
  artist_id?: string | null;
  artist_name?: string;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10B981',
  GRACE: '#F59E0B',
  PAST_DUE: '#F59E0B',
  EXPIRED: '#EF4444',
  CANCELLED: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active ✅',
  GRACE: 'Grace Period ⚠️',
  PAST_DUE: 'Payment Due ⚠️',
  EXPIRED: 'Expired ❌',
  CANCELLED: 'Cancelled',
};

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default function SubscriptionDetail({ navigation, route }: any) {
  const artistId: string = String(route?.params?.artistId ?? '');
  const planType: 'ARTIST' | 'PLATFORM' = route?.params?.type === 'PLATFORM' ? 'PLATFORM' : 'ARTIST';

  const [sub, setSub] = useState<SubscriptionRecord | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [downloadingTxId, setDownloadingTxId] = useState<string | null>(null);

  const fetchSub = async () => {
    try {
      setLoading(true);
      const details = await userService.getSubscriptionDetails();
      if (!details) {
        setSub(null);
        return;
      }

      if (planType === 'PLATFORM') {
        setSub(details.platform);
        setTransactions(details.transactions.filter(tx => !tx.artistId));
      } else {
        const found = details.artists.find(a => String(a.artistId) === artistId);
        setSub(found || null);
        setTransactions(details.transactions.filter(tx => String(tx.artistId) === artistId));
      }
    } catch {
      setSub(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSub();
  };

  useEffect(() => { fetchSub(); }, [artistId, planType]);

  const status = (sub?.status ?? '').toUpperCase();
  const statusColor = STATUS_COLORS[status] ?? '#6B7280';
  const statusLabel = STATUS_LABELS[status] ?? status;
  const isPlatform = sub?.type === 'PLATFORM';

  // Compute days left
  const endDate = sub?.end_date ?? sub?.next_billing_date;
  const daysLeft = endDate
    ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 86400))
    : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

  const handleRenew = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert(
        'Billing Policy',
        'Digital content purchases must be made via our website: music-platform.com. Please manage your plan online to maintain access.',
        [{ text: 'Got it' }]
      );
      return;
    }
    navigation.navigate('SubscriptionFlow', {
      artistId: sub?.artist_id ?? artistId,
      artistName: sub?.artist_name,
      defaultPlan: sub?.type ?? planType,
    });
  };

  const handleToggleAutoRenew = async (enable: boolean) => {
    if (!sub?.id) return;
    setToggling(true);
    try {
      const success = await userService.toggleAutoRenew(sub.id, enable);
      if (success) {
        setSub(prev => prev ? { ...prev, autoRenew: enable } : null);
        Alert.alert('Success', `Auto-renew turned ${enable ? 'ON' : 'OFF'}.`);
      } else {
        Alert.alert('Error', 'Failed to update auto-renew settings.');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setToggling(false);
    }
  };

  const handleCancelConfirm = async (reason: string, acceptedOffer: boolean) => {
    if (!sub?.id) return;
    try {
      const res = await userService.cancelSubscription(sub.id, {
        reason,
        accepted_retention_offer: acceptedOffer
      });
      if (res.success) {
        if (acceptedOffer) {
          Alert.alert('Offer Applied 🎁', 'Your 20% discount has been applied to your next cycle! Thank you for staying.');
        } else {
          Alert.alert('Cancelled', 'Your subscription will not renew.');
        }
        fetchSub();
      }
    } catch {
      Alert.alert('Error', 'Failed to process request.');
    }
  };

  const handleDownloadInvoice = async (txId: string) => {
    try {
      // Safety check for native module availability
      if (!FileSystem || !FileSystem.downloadAsync) {
        Alert.alert('Module Missing', 'The download feature requires a newer version of the app. Please update your app.');
        return;
      }

      setDownloadingTxId(txId);
      const url = userService.getInvoiceUrl(txId);
      const filename = `invoice_${txId}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      console.log(`[DOWNLOAD] Starting download from ${url} to ${fileUri}`);
      
      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: {
          'Authorization': (userService as any).apiV1?.defaults?.headers?.common?.['Authorization'] || ''
        }
      });

      if (downloadRes.status !== 200) {
        Alert.alert('Error', 'Failed to download invoice PDF.');
        return;
      }

      // Safe check for Sharing module
      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'Invoice downloaded successfully.');
      }
    } catch (err) {
      console.error('[INVOICE] Download failed', err);
      Alert.alert('Error', 'Failed to retrieve invoice.');
    } finally {
      setDownloadingTxId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FF7A18" size="large" />
      </View>
    );
  }

  if (!sub) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No active subscription found.</Text>
          <Text style={styles.complianceText}>To subscribe, please visit music-platform.com on your web browser.</Text>
          <Pressable style={styles.renewBtn} onPress={handleRenew}>
            <LinearGradient colors={['#FF7A18', '#FF3D00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.renewBtnInner}>
              <Text style={styles.renewBtnText}>Learn More</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary label="Subscription Detail">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription Detail</Text>
          <Pressable onPress={onRefresh} style={styles.refreshBtn}>
            <RefreshCw color="#fff" size={16} />
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF7A18" />
          }
        >
          {/* Plan header banner */}
          <LinearGradient
            colors={isPlatform ? ['#1a2a4a', '#0d1b2a'] : ['#2a1a0a', '#1a0d00']}
            style={styles.planBanner}
          >
            <View style={styles.planBannerIcon}>
              {isPlatform ? <Crown color="#4AA3FF" size={32} /> : <Award color="#FF7A18" size={32} />}
            </View>
            <Text style={styles.planBannerTitle}>
              {isPlatform ? 'Platform Plan' : 'Artist Plan'}
            </Text>
            {!isPlatform && sub.artist_name ? (
              <View style={styles.artistNameRow}>
                <BadgeCheck color="#4AA3FF" fill="#4AA3FF" size={16} />
                <Text style={styles.artistNameText}>{sub.artist_name}</Text>
              </View>
            ) : null}
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </LinearGradient>

          {/* Details card */}
          <BlurView intensity={22} tint="dark" style={styles.card}>
            <InfoRow label="Plan Type" value={sub.plan_type ?? 'MONTHLY'} />
            <Divider />
            <InfoRow label="Started" value={formatDate(sub.start_date)} />
            <Divider />
            <InfoRow label={status === 'ACTIVE' ? 'Renews On' : 'Expired On'} value={formatDate(endDate)} />
            {sub.grace_ends_at && (status === 'GRACE' || status === 'PAST_DUE') && (
              <>
                <Divider />
                <InfoRow label="Grace Ends" value={formatDate(sub.grace_ends_at)} color="#F59E0B" />
              </>
            )}
            <Divider />
            <InfoRow label="Auto-Renew" value={sub.auto_renew ? 'On' : 'Off'} />
            <Divider />
            <AutoRenewToggle 
              enabled={sub.autoRenew} 
              onToggle={handleToggleAutoRenew}
              loading={toggling}
            />
          </BlurView>

          {/* Expiry warning */}
          {isExpiringSoon && status === 'ACTIVE' && (
            <View style={styles.warningCard}>
              <AlertTriangle color="#F59E0B" size={16} />
              <Text style={styles.warningText}>
                Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}. Renew now to avoid interruption.
              </Text>
            </View>
          )}

          {/* Grace period notice */}
          {(status === 'GRACE' || status === 'PAST_DUE') && (
            <View style={styles.warningCard}>
              <AlertTriangle color="#F59E0B" size={16} />
              <Text style={styles.warningText}>
                You're in grace period. Renew now to maintain access.
              </Text>
            </View>
          )}

          {/* What's included */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>What's included</Text>
            {(isPlatform
              ? ['HD streaming (720p / 1080p)', 'No ads', 'Unlimited skips', 'Priority support']
              : ['Early access to releases', 'Exclusive songs', 'Behind-the-scenes content', 'Fan community access']
            ).map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Text style={styles.tick}>✓</Text>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Renew / Cancel actions */}
          {(status !== 'ACTIVE' || isExpiringSoon) && (
            <Pressable style={styles.renewBtn} onPress={handleRenew}>
              <LinearGradient colors={['#FF7A18', '#FF3D00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.renewBtnInner}>
                <RefreshCw color="#fff" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.renewBtnText}>{isExpiringSoon ? 'Renew Early' : 'Renew Now'}</Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Payment History */}
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Payment History</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>No transactions found for this plan.</Text>
              </View>
            ) : (
              transactions.map(tx => (
                <TransactionRow 
                  key={tx.id} 
                  tx={tx} 
                  onDownload={() => handleDownloadInvoice(tx.id)}
                />
              ))
            )}
          </View>

          <View style={{ height: 24 }} />

          {status === 'ACTIVE' && (
            <Pressable style={styles.cancelBtn} onPress={() => setCancelModalVisible(true)}>
              <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
            </Pressable>
          )}

          <Pressable style={styles.supportRow}>
            <Text style={styles.supportText}>Need help? Contact Support &gt;</Text>
          </Pressable>
        </ScrollView>

        {/* Cancel Flow */}
        <CancellationFlow 
           visible={cancelModalVisible}
           onClose={() => setCancelModalVisible(false)}
           onConfirm={handleCancelConfirm}
           planName={isPlatform ? 'Platform Plan' : `Artist Plan (${sub.artist_name})`}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />;
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
  value: { color: '#fff', fontSize: 13, fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  complianceText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500', marginBottom: 20, textAlign: 'center' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  scrollContent: { padding: 16, paddingBottom: 40 },

  planBanner: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  planBannerIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  planBannerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  artistNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  artistNameText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700', marginLeft: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusPillText: { fontSize: 13, fontWeight: '800' },

  card: {
    borderRadius: 18, overflow: 'hidden',
    paddingHorizontal: 16, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 16,
  },

  warningCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.09)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 14, padding: 12, marginBottom: 12,
  },
  warningText: { color: '#F59E0B', fontSize: 13, fontWeight: '700', marginLeft: 10, flex: 1 },

  benefitsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  benefitsTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tick: { color: '#FF7A18', fontSize: 16, fontWeight: '900', width: 22 },
  benefitText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', flex: 1 },

  renewBtn: {
    height: 52, borderRadius: 14, overflow: 'hidden', marginBottom: 10,
  },
  renewBtnInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  renewBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  cancelBtn: {
    height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 10,
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },

  supportRow: { alignItems: 'center', paddingVertical: 16 },
  supportText: { color: 'rgba(255,255,255,0.40)', fontSize: 13, fontWeight: '700' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%', borderRadius: 18, overflow: 'hidden',
    paddingHorizontal: 18, paddingVertical: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  modalSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 18 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtnGhost: {
    height: 44, paddingHorizontal: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalBtnGhostText: { color: 'rgba(255,255,255,0.78)', fontWeight: '800', fontSize: 13 },
  modalBtnDanger: {
    height: 44, paddingHorizontal: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  modalBtnDangerText: { color: '#EF4444', fontWeight: '900', fontSize: 13 },

  historySection: { marginTop: 8 },
  historyTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  emptyHistory: { paddingVertical: 20, alignItems: 'center' },
  emptyHistoryText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
});
