import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BadgeCheck, Pause, Play } from 'lucide-react-native';
import ErrorBoundary from '../ui/ErrorBoundary';

type SubDetail = {
  artistId: string;
  name: string;
  label: string;
  verified: boolean;
  banner: string;
  status: 'Active' | 'Canceled';
  renewDate: string;
};

type Mini = {
  title: string;
  artistName: string;
  artwork: string;
};

export default function SubscriptionDetail({ navigation, route }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const artistId: string = String(route?.params?.artistId ?? 'luna-ray');
  const incomingStatusRaw = route?.params?.status;
  const incomingRenewDateRaw = route?.params?.renewDate;
  const incomingStatus: SubDetail['status'] | null =
    incomingStatusRaw === 'Active' || incomingStatusRaw === 'Canceled' ? incomingStatusRaw : null;
  const incomingRenewDate = typeof incomingRenewDateRaw === 'string' ? incomingRenewDateRaw : null;

  const [detail, setDetail] = useState<SubDetail | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mini: Mini = useMemo(
    () => ({
      title: 'Secret Melody',
      artistName: detail?.name ?? 'Luna Ray',
      artwork:
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
    }),
    [detail?.name]
  );

  useEffect(() => {
    const mockById: Record<string, SubDetail> = {
      'luna-ray': {
        artistId: 'luna-ray',
        name: 'Luna Ray',
        label: 'Dusian',
        verified: true,
        banner:
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
        status: 'Active',
        renewDate: 'May 24, 2024',
      },
      'david-stone': {
        artistId: 'david-stone',
        name: 'David Stone',
        label: 'Dusian',
        verified: false,
        banner:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=1400&q=80',
        status: 'Active',
        renewDate: 'Jun 02, 2024',
      },
      'kari-lucas': {
        artistId: 'kari-lucas',
        name: 'Kari Lucas',
        label: 'Dusian',
        verified: false,
        banner:
          'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=1400&q=80',
        status: 'Active',
        renewDate: 'Jun 11, 2024',
      },
    };

    const base = mockById[artistId] ?? mockById['luna-ray'];
    setDetail({
      ...base,
      status: incomingStatus ?? base.status,
      renewDate: incomingRenewDate ?? base.renewDate,
    });
  }, [artistId]);

  if (!detail) return <View style={styles.container} />;

  return (
    <ErrorBoundary label="Payments: Subscription Detail">
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription Detail</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.bannerWrap}>
          <Image source={{ uri: detail.banner }} style={styles.bannerImg} />
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.92)']}
            style={styles.bannerGrad}
          />

          <View style={styles.bannerText}>
            <View style={styles.nameRow}>
              <Text style={styles.artistName}>{detail.name}</Text>
              {detail.verified ? (
                <View style={styles.verifiedWrap}>
                  <BadgeCheck color="#4AA3FF" fill="#4AA3FF" size={18} />
                </View>
              ) : null}
            </View>
            <Text style={styles.labelText}>{detail.label}</Text>
          </View>
        </View>

        <View style={styles.cardOuter}>
          <BlurView intensity={22} tint="dark" style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.leftLabel}>Status</Text>
              <View style={styles.statusRight}>
                <View style={styles.greenDot} />
                <Text style={styles.rightValue}>{detail.status}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.leftLabel}>Renews</Text>
              <Text style={styles.rightValue}>{detail.renewDate}</Text>
            </View>

            <Pressable style={styles.cancelBtn} onPress={() => setCancelOpen(true)}>
              <LinearGradient
                colors={['rgba(255,122,24,0.28)', 'rgba(255,122,24,0.12)']}
                style={styles.cancelBtnInner}
              >
                <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
              </LinearGradient>
            </Pressable>
          </BlurView>

          <Pressable onPress={() => {}} style={styles.supportRow}>
            <Text style={styles.supportText}>Need help?  Contact Support  &gt;</Text>
          </Pressable>
        </View>

      <Modal
        visible={cancelOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView intensity={18} tint="dark" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel subscription?</Text>
            <Text style={styles.modalSub}>You will lose early access when your billing period ends.</Text>

            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnGhost} onPress={() => setCancelOpen(false)}>
                <Text style={styles.modalBtnGhostText}>Keep</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnDanger}
                onPress={() => {
                  setCancelOpen(false);
                }}
              >
                <Text style={styles.modalBtnDangerText}>Cancel</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>

      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  bannerWrap: {
    height: 310,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  bannerGrad: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  verifiedWrap: {
    marginLeft: 10,
    marginTop: 2,
  },
  labelText: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
  },

  cardOuter: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  leftLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
  },
  rightValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '800',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#20C15A',
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.30)',
  },
  cancelBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '800',
  },
  supportRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  supportText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  modalSub: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalBtnGhost: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalBtnGhostText: {
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '800',
  },
  modalBtnDanger: {
    marginLeft: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,122,24,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.35)',
  },
  modalBtnDangerText: {
    color: '#FF7A18',
    fontWeight: '900',
  },

});
