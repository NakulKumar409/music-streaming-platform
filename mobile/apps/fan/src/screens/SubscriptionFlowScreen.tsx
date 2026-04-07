import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeCheck, Check, Crown, ShieldCheck, Star, X } from 'lucide-react-native';
import ErrorBoundary from '../ui/ErrorBoundary';
import { apiV1 } from '../services/api';
import RazorpayCheckout from 'react-native-razorpay';

type PaymentStep = 'PLAN_SELECT' | 'OFFER' | 'PROCESSING' | 'SUCCESS';
type PlanType = 'ARTIST' | 'PLATFORM';

type RouteParams = {
  artistId?: string;
  artistName?: string;
  contentId?: string;
  artwork?: string;
  defaultPlan?: PlanType;
};

function formatRenewDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function showPaymentError(message: string) {
  const msg = (message || 'Failed to start payment').toString();
  if (Platform.OS === 'web') {
    try { (globalThis as any)?.alert?.(msg); return; } catch { }
  }
  Alert.alert('Payment Error', msg);
}

// ─── Plan cards data ──────────────────────────────────────────────────────────
const ARTIST_BENEFITS = [
  'Early access to new releases',
  'Exclusive songs & behind-the-scenes',
  'Direct support to the artist',
  'Fan-only community access',
];

const PLATFORM_BENEFITS = [
  'HD streaming (720p / 1080p)',
  'Unlimited skips & offline mode',
  'No ads on all artists',
  'Priority customer support',
];

export default function SubscriptionFlowScreen({ navigation, route }: any) {
  const params: RouteParams = route?.params ?? {};
  const artistId = params.artistId ?? '';
  const artistName = params.artistName ?? 'Artist';
  const contentId = params.contentId;
  const bgUri =
    params.artwork ??
    'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?auto=format&fit=crop&w=1400&q=80';

  const hasArtist = Boolean(artistId);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    params.defaultPlan ?? (hasArtist ? 'ARTIST' : 'PLATFORM')
  );
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('PLAN_SELECT');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Payment received. Confirming…');

  useEffect(() => {
    if (!isVerifyingPayment) return;
    setProcessingMessage('Payment received. Confirming…');
    const t = setTimeout(() => {
      setProcessingMessage('Still confirming. Please wait a moment…');
    }, 5000);
    return () => clearTimeout(t);
  }, [isVerifyingPayment]);

  const amountPaise = selectedPlan === 'PLATFORM' ? 9900 : 4990; // ₹99 platform, ₹49.90 artist
  const priceDisplay = selectedPlan === 'PLATFORM' ? '₹99' : '₹49';
  const planLabel = selectedPlan === 'PLATFORM' ? 'Platform Plan' : `${artistName} Artist Plan`;
  const planId = selectedPlan === 'PLATFORM'
    ? (process.env.EXPO_PUBLIC_RAZORPAY_PLATFORM_PLAN_ID ?? '')
    : (process.env.EXPO_PUBLIC_RAZORPAY_ARTIST_PLAN_ID ?? '');

  const startPayment = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert(
        'Billing Policy',
        'Digital content purchases must be made via our website: music-platform.com. Please manage your plan online to maintain access.',
        [{ text: 'Got it' }]
      );
      return;
    }
    if (isCreatingOrder || isVerifyingPayment) return;
    try {
      setIsCreatingOrder(true);
      const artistIdValue = artistId.toString().trim();

      // Create Razorpay order
      const res = await apiV1.post('/subscriptions/order', {
        amount: amountPaise,
        artistId: artistIdValue || '0',
        artistName,
      });

      const nextOrderId = (res.data?.order?.id ?? '').toString();
      if (!nextOrderId) throw new Error('Order creation failed — order id missing');

      const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || (res.data?.order?.key_id ?? '').toString();
      if (!keyId) throw new Error('Missing Razorpay key_id');

      if (Platform.OS === 'web') {
        throw new Error('Payments are not supported in the web preview. Please use the Android/iOS app.');
      }

      const options: any = {
        key: keyId,
        amount: Number(res.data?.order?.amount ?? amountPaise),
        currency: (res.data?.order?.currency ?? 'INR').toString(),
        name: 'Music Platform',
        description: planLabel,
        order_id: nextOrderId,
        notes: { artist_id: artistIdValue, plan_type: selectedPlan },
        theme: { color: '#FF7A18' },
      };

      let paymentData: any;
      try {
        paymentData = await RazorpayCheckout.open(options);
      } catch (e: any) {
        const msg = (e?.description ?? e?.error?.description ?? e?.message ?? '').toString();
        if (/cancel/i.test(msg)) return;
        throw new Error(msg || 'Payment cancelled');
      }

      const razorpay_order_id = (paymentData?.razorpay_order_id ?? nextOrderId).toString();
      const razorpay_payment_id = (paymentData?.razorpay_payment_id ?? '').toString();
      const razorpay_signature = (paymentData?.razorpay_signature ?? '').toString();

      if (!razorpay_payment_id || !razorpay_signature) {
        throw new Error('Payment completed but required fields were missing');
      }

      setPaymentStep('PROCESSING');
      setIsVerifyingPayment(true);

      // Confirm payment
      await apiV1.post('/subscriptions/confirm', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        artist_id: artistIdValue,
      });

      // Poll for ACTIVE status (max 60 seconds)
      const deadlineMs = Date.now() + 60_000;
      let subscription: any = null;
      while (Date.now() < deadlineMs) {
        const endpoint = selectedPlan === 'PLATFORM'
          ? '/subscriptions/platform'
          : `/subscriptions/me?artistId=${encodeURIComponent(artistIdValue)}`;

        const sRes = await apiV1.get(endpoint);
        subscription = sRes.data?.subscription ?? null;
        const status = (subscription?.status ?? '').toString().toUpperCase();
        if (status === 'ACTIVE') break;
        await new Promise((r) => setTimeout(r, 2000));
      }

      setPaymentStep('SUCCESS');
    } catch (err: any) {
      setPaymentStep('PLAN_SELECT');
      showPaymentError(err?.message || 'Failed to start payment');
    } finally {
      setIsCreatingOrder(false);
      setIsVerifyingPayment(false);
    }
  };

  const onStartListening = () => {
    if (selectedPlan === 'ARTIST' && artistId) {
      navigation.navigate('Artist', { artistId, unlocked: true, contentId });
    } else {
      navigation.goBack();
    }
  };

  const goBack = () => {
    if (paymentStep === 'OFFER') {
      setPaymentStep('PLAN_SELECT');
    } else {
      navigation.goBack();
    }
  };

  return (
    <ErrorBoundary label="Payments: Subscription Flow">
      <SafeAreaView style={styles.container}>
        <ImageBackground source={{ uri: bgUri }} style={styles.bg} resizeMode="cover">
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.96)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Header */}
          {paymentStep !== 'SUCCESS' && (
            <Pressable style={styles.backBtn} onPress={goBack}>
              <X color="#fff" size={22} />
            </Pressable>
          )}

          {/* ── PLAN SELECT SCREEN ─────────────────────────────────── */}
          {paymentStep === 'PLAN_SELECT' && (
            <ScrollView
              style={styles.scrollWrap}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.headline}>Choose Your Plan</Text>
              <Text style={styles.subline}>Unlock exclusive content and HD streaming</Text>

              {/* Why upgrade? */}
              <BlurView intensity={20} tint="dark" style={styles.whyCard}>
                <Text style={styles.whyTitle}>Why upgrade?</Text>
                <View style={styles.whyRow}>
                  <Check color="#FF7A18" size={16} />
                  <Text style={styles.whyText}>Better quality audio & video</Text>
                </View>
                <View style={styles.whyRow}>
                  <Check color="#FF7A18" size={16} />
                  <Text style={styles.whyText}>Exclusive early-access content</Text>
                </View>
                <View style={styles.whyRow}>
                  <Check color="#FF7A18" size={16} />
                  <Text style={styles.whyText}>Directly support your favourite artists</Text>
                </View>
              </BlurView>

              {/* Artist Plan card */}
              {hasArtist && (
                <Pressable
                  style={[styles.planCard, selectedPlan === 'ARTIST' && styles.planCardActive]}
                  onPress={() => setSelectedPlan('ARTIST')}
                >
                  <View style={styles.planCardHeader}>
                    <View style={styles.planIconWrap}>
                      <Star color="#FF7A18" size={20} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.planCardTitle}>Artist Plan</Text>
                      <Text style={styles.planCardSub}>{artistName}</Text>
                    </View>
                    <View>
                      <Text style={styles.planCardPrice}>₹49</Text>
                      <Text style={styles.planCardPriceSub}>/month</Text>
                    </View>
                    {selectedPlan === 'ARTIST' && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.planDivider} />
                  {ARTIST_BENEFITS.map((b, i) => (
                    <View key={i} style={styles.benefitRow}>
                      <Text style={styles.tick}>✓</Text>
                      <Text style={styles.benefitText}>{b}</Text>
                    </View>
                  ))}
                </Pressable>
              )}

              {/* Platform Plan card */}
              <Pressable
                style={[styles.planCard, selectedPlan === 'PLATFORM' && styles.planCardActive]}
                onPress={() => setSelectedPlan('PLATFORM')}
              >
                <View style={styles.planCardHeader}>
                  <View style={[styles.planIconWrap, { backgroundColor: 'rgba(100,160,255,0.15)' }]}>
                    <Crown color="#4AA3FF" size={20} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.planCardTitle}>Platform Plan</Text>
                    <Text style={styles.planCardSub}>HD Streaming globally</Text>
                  </View>
                  <View>
                    <Text style={styles.planCardPrice}>₹99</Text>
                    <Text style={styles.planCardPriceSub}>/month</Text>
                  </View>
                  {selectedPlan === 'PLATFORM' && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓</Text>
                    </View>
                  )}
                </View>
                <View style={styles.planDivider} />
                {PLATFORM_BENEFITS.map((b, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <Text style={styles.tick}>✓</Text>
                    <Text style={styles.benefitText}>{b}</Text>
                  </View>
                ))}
              </Pressable>

              {/* CTA */}
              <Pressable
                style={styles.ctaBtn}
                onPress={Platform.OS === 'web' ? () => setPaymentStep('OFFER') : startPayment}
              >
                <LinearGradient
                  colors={['#FF7A18', '#FF3D00']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.ctaBtnInner}
                >
                  <Text style={styles.ctaBtnText}>
                    {Platform.OS === 'web' ? `Continue → Pay ${priceDisplay}/mo` : 'Learn More'}
                  </Text>
                </LinearGradient>
              </Pressable>

              <Text style={styles.disclaimer}>
                Cancel anytime. Auto-renews monthly. Access is controlled by backend verification.
              </Text>
            </ScrollView>
          )}

          {/* ── OFFER / CONFIRM SCREEN ────────────────────────────────── */}
          {paymentStep === 'OFFER' && (
            <View style={styles.offerWrap}>
              <View style={styles.artistRow}>
                {selectedPlan === 'PLATFORM' ? (
                  <Crown color="#4AA3FF" size={28} style={{ marginRight: 10 }} />
                ) : (
                  <Star color="#FF7A18" size={28} style={{ marginRight: 10 }} />
                )}
                <Text style={styles.artistName}>{planLabel}</Text>
                {selectedPlan === 'ARTIST' && (
                  <View style={styles.verifiedWrap}>
                    <BadgeCheck color="#4AA3FF" fill="#4AA3FF" size={18} />
                  </View>
                )}
              </View>

              <BlurView intensity={22} tint="dark" style={styles.glassCard}>
                <View style={styles.priceWrap}>
                  <Text style={styles.priceText}>{priceDisplay}</Text>
                  <Text style={styles.priceUnit}>/month</Text>
                </View>

                <View style={styles.benefitsWrap}>
                  {(selectedPlan === 'PLATFORM' ? PLATFORM_BENEFITS : ARTIST_BENEFITS).map((b, i) => (
                    <View key={i} style={styles.benefitRow}>
                      <Text style={styles.checkMark}>✓</Text>
                      <Text style={styles.benefitText}>{b}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  style={styles.primaryBtn}
                  onPress={startPayment}
                  disabled={isCreatingOrder || isVerifyingPayment}
                >
                  <LinearGradient
                    colors={['rgba(255,122,24,0.45)', 'rgba(255,122,24,0.20)']}
                    style={styles.primaryBtnInner}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isCreatingOrder ? 'Creating Order…' : isVerifyingPayment ? 'Confirming…' : 'Pay Now'}
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Text style={styles.secureNote}>
                  {Platform.OS === 'web' 
                    ? '🔒 Secured by Razorpay · Backend verified' 
                    : '👤 Manage subscription via website'}
                </Text>
              </BlurView>
            </View>
          )}

          {/* ── PROCESSING ────────────────────────────────────────────── */}
          {paymentStep === 'PROCESSING' && (
            <View style={styles.processingWrap}>
              <View style={styles.spinnerWrap}>
                <ActivityIndicator size="large" color="#FF7A18" />
              </View>
              <Text style={styles.processingText}>{processingMessage}</Text>
            </View>
          )}

          {/* ── SUCCESS ───────────────────────────────────────────────── */}
          {paymentStep === 'SUCCESS' && (
            <View style={styles.successWrap}>
              <View style={styles.successIconWrap}>
                <Check color="#FF7A18" size={34} strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>You're all set! 🎉</Text>
              <Text style={styles.successSub}>
                {selectedPlan === 'PLATFORM'
                  ? 'HD streaming is now unlocked across the platform.'
                  : `You now have early access to ${artistName}'s exclusive content.`}
              </Text>
              <View style={styles.successBadgeRow}>
                <ShieldCheck color="#10B981" size={16} />
                <Text style={styles.successBadgeText}>Access verified by backend · Expires monthly</Text>
              </View>
              <Pressable style={styles.primaryBtnWide} onPress={onStartListening}>
                <LinearGradient
                  colors={['#FF7A18', '#FF3D00']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnInner}
                >
                  <Text style={styles.primaryBtnText}>
                    {selectedPlan === 'PLATFORM' ? 'Start Streaming in HD' : 'Start Listening'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </ImageBackground>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },

  backBtn: {
    position: 'absolute',
    top: 54,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // Plan Select
  scrollWrap: { flex: 1 },
  scrollContent: {
    paddingTop: 100,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headline: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },

  whyCard: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  whyTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  whyText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },

  planCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    marginBottom: 16,
  },
  planCardActive: {
    borderColor: '#FF7A18',
    backgroundColor: 'rgba(255,122,24,0.06)',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,122,24,0.15)',
  },
  planCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  planCardSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  planCardPrice: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  planCardPriceSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  selectedBadge: {
    marginLeft: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF7A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  planDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  tick: { color: '#FF7A18', fontSize: 14, fontWeight: '900', width: 20 },
  benefitText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  ctaBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 16,
  },
  ctaBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Offer screen
  offerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  artistName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  verifiedWrap: { marginLeft: 10, marginTop: 2 },

  glassCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  priceText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  priceUnit: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
    marginBottom: 6,
  },
  benefitsWrap: { paddingTop: 16, paddingBottom: 14 },
  checkMark: { color: '#FF7A18', fontSize: 18, fontWeight: '900', width: 24 },

  primaryBtn: {
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.35)',
    marginTop: 6,
  },
  primaryBtnWide: {
    width: '100%',
    maxWidth: 340,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 18,
  },
  primaryBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },

  secureNote: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },

  // Processing
  processingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  spinnerWrap: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 18,
  },
  processingText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '700' },

  // Success
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,122,24,0.75)',
    backgroundColor: 'rgba(255,122,24,0.10)',
    marginBottom: 18,
  },
  successTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  successSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  successBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
  },
  successBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },
});
