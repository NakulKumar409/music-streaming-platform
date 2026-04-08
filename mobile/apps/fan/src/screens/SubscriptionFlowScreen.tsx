import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { BadgeCheck, Check, Crown, Sparkles, Star, X, Zap, AlertTriangle, ShieldCheck, Lock, Share2 } from 'lucide-react-native';
import ErrorBoundary from '../ui/ErrorBoundary';
import RazorpayCheckout from 'react-native-razorpay';
import { apiV1 } from '../services/api';
import { userService, UpsellStatus, PlatformConfig } from '../services/userService';
// import * as Sharing from 'expo-sharing'; // Moved to dynamic require to prevent crash on boot

const { width: SW, height: SH } = Dimensions.get('window');

type PaymentStep = 'PLAN_SELECT' | 'PROCESSING' | 'SUCCESS';
type PlanType = 'ARTIST' | 'PLATFORM';

type RouteParams = {
  artistId?: string;
  artistName?: string;
  contentId?: string;
  artwork?: string;
  defaultPlan?: PlanType;
};

function showPaymentError(message: string) {
  const msg = (message || 'Failed to start payment').toString();
  Alert.alert('Payment Error', msg);
}

// ─── Benefit lists ─────────────────────────────────────────────────────────────
const PLATFORM_BENEFITS = [
  { text: 'HD streaming (720p / 1080p)', icon: '🎬' },
  { text: 'Crystal clear audio quality', icon: '🎵' },
  { text: 'Works across all content', icon: '🌐' },
  { text: 'Ad-free experience', icon: '✨' },
];

const ARTIST_BENEFITS = [
  { text: 'Exclusive artist content', icon: '🎤' },
  { text: 'Early access to new releases', icon: '⚡' },
  { text: 'Direct artist support', icon: '❤️' },
  { text: 'Behind-the-scenes access', icon: '🎭' },
];

// ─── Decorative floating orbs ──────────────────────────────────────────────────
function FloatingOrbs() {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      ).start();
    loop(anim1, 3400, 0);
    loop(anim2, 4200, 700);
    loop(anim3, 3800, 1400);
  }, []);

  const translateY1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const translateY3 = anim3.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[s.orb, s.orb1, { transform: [{ translateY: translateY1 }] }]} />
      <Animated.View style={[s.orb, s.orb2, { transform: [{ translateY: translateY2 }] }]} />
      <Animated.View style={[s.orb, s.orb3, { transform: [{ translateY: translateY3 }] }]} />
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function SubscriptionFlowScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const params: RouteParams = route?.params ?? {};
  const artistId = params.artistId ?? '';
  const artistName = params.artistName ?? 'Artist';
  const contentId = params.contentId;
  const hasArtist = Boolean(artistId);

  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    params.defaultPlan ?? (hasArtist ? 'ARTIST' : 'PLATFORM')
  );
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('PLAN_SELECT');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing payment…');
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [isPlatformConfigLoading, setIsPlatformConfigLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upsellStatus, setUpsellStatus] = useState<any>(null);
  const [artistProfile, setArtistProfile] = useState<any>(null);
  const [isArtistProfileLoading, setIsArtistProfileLoading] = useState(false);


  // Fade-in on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    // Fetch dynamic config
    setIsPlatformConfigLoading(true);
    userService.getPlatformConfig().then(cfg => {
      if (cfg) setPlatformConfig(cfg);
    }).catch(() => undefined).finally(() => {
      setIsPlatformConfigLoading(false);
    });

    // Track upsell if landing from locked content
    if (contentId) {
      userService.trackUpsellAttempt().then(() => {
        userService.getUpsellStatus().then(status => {
          if (status) setUpsellStatus(status);
        });
      });
    }

    // Fetch artist profile for pricing
    if (artistId && !isNaN(Number(artistId))) {
      setIsArtistProfileLoading(true);
      userService.getArtistProfile(Number(artistId))
        .then(profile => {
          if (profile) setArtistProfile(profile);
        })
        .finally(() => setIsArtistProfileLoading(false));
    }
  }, [contentId, fadeAnim, slideAnim, artistId]);

  useEffect(() => {
    if (!isVerifyingPayment && !isCreatingOrder) return;
    setProcessingMessage('Processing payment…');
    const t = setTimeout(() => setProcessingMessage('Almost there, verifying with server…'), 5000);
    return () => clearTimeout(t);
  }, [isVerifyingPayment, isCreatingOrder]);

  const isPlatform = selectedPlan === 'PLATFORM';
  
  // Dynamic pricing logic & Discounts
  const rawPrice = platformConfig?.price ?? 0;
  const discountPrice = platformConfig?.discount_price;
  const discountMonths = platformConfig?.discount_months ?? 1;
  const platformDuration = platformConfig?.duration ?? 'monthly';
  const platformCurrency = platformConfig?.currency ?? 'INR';
  const platformFeaturesRaw = platformConfig?.features ?? [];
  
  const hasDiscount = Boolean(discountPrice && discountPrice < rawPrice);
  const finalPrice = hasDiscount ? Number(discountPrice) : rawPrice;

  // Artist Price logic
  const artistPrice = artistProfile?.subscriptionPrice ?? 49;
  const artistPriceDisplay = `₹${artistPrice}`;

  const amountPaise = isPlatform ? (finalPrice * 100) : (artistPrice * 100);
  const platformPriceDisplay = isPlatformConfigLoading || finalPrice === 0 ? '—' : `₹${finalPrice}`;
  const priceDisplay = isPlatform 
    ? platformPriceDisplay
    : artistPriceDisplay;
  const durationLabel = platformDuration === 'yearly' ? '/yr' : '/mo';

  const planLabel = isPlatform ? 'Platform Plan' : `${artistName} Plan`;
  const accentColor = isPlatform ? '#6C63FF' : '#FF7A18';
  const accentAlt = isPlatform ? '#4AA3FF' : '#FF3D00';

  const mappedPlatformBenefits = platformFeaturesRaw.length > 0 
    ? platformFeaturesRaw.map((f, i) => ({ text: f, icon: PLATFORM_BENEFITS[i % PLATFORM_BENEFITS.length].icon }))
    : PLATFORM_BENEFITS;

  const hasCustomFeatures = artistProfile?.subscriptionFeatures?.length && artistProfile.subscriptionFeatures.length > 0;
  const mappedArtistBenefits = hasCustomFeatures
    ? artistProfile!.subscriptionFeatures!.map((f, i) => ({ text: f, icon: ARTIST_BENEFITS[i % ARTIST_BENEFITS.length].icon }))
    : ARTIST_BENEFITS;

  const startPayment = async () => {
    if (isCreatingOrder || isVerifyingPayment) return;
    try {
      setIsCreatingOrder(true);
      const artistIdValue = artistId.toString().trim();

      // Duplicate check
      try {
        const summary = await userService.getSubscriptionPlanSummary();
        if (selectedPlan === 'PLATFORM' && summary.platformPlan?.status === 'ACTIVE') {
          setErrorMessage('You already have an active Platform Plan.');
          setIsCreatingOrder(false);
          return;
        }
        if (selectedPlan === 'ARTIST' && summary.artistPlan?.artistId == artistIdValue && summary.artistPlan?.status === 'ACTIVE') {
          setErrorMessage(`You already have an active subscription for ${artistName}.`);
          setIsCreatingOrder(false);
          return;
        }
      } catch (_) {}

      // Create order
      let res: any;
      try {
        res = await apiV1.post('/subscriptions/order', {
          amount: amountPaise,
          artistId: artistIdValue || '0',
          artistName,
        });
      } catch (orderErr: any) {
        const status = orderErr?.response?.status;
        const serverMsg = orderErr?.response?.data?.message || '';
        if (status === 409) {
          setErrorMessage(`You already have an active ${isPlatform ? 'Platform' : 'Artist'} subscription.`);
          setIsCreatingOrder(false);
          return;
        }
        throw new Error(serverMsg || orderErr?.message || 'Failed to create order');
      }

      const nextOrderId = (res.data?.order?.id ?? '').toString();
      if (!nextOrderId) throw new Error('Order creation failed — order id missing');

      const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || (res.data?.order?.key_id ?? '').toString();
      if (!keyId) throw new Error('Missing Razorpay key_id');

      if (Platform.OS === 'web') {
        throw new Error('Payments not supported in web preview. Please use the mobile app.');
      }

      const options: any = {
        key: keyId,
        amount: Number(res.data?.order?.amount ?? amountPaise),
        currency: (res.data?.order?.currency ?? 'INR').toString(),
        name: 'Music Platform',
        description: planLabel,
        order_id: nextOrderId,
        notes: { artist_id: artistIdValue || '0', plan_type: selectedPlan },
        theme: { color: accentColor },
      };

      let paymentData: any;
      try {
        paymentData = await RazorpayCheckout.open(options);
      } catch (e: any) {
        const msg = (e?.description ?? e?.error?.description ?? e?.message ?? '').toString();
        if (/cancel/i.test(msg)) { setIsCreatingOrder(false); return; }
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

      await apiV1.post('/subscriptions/confirm', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        artist_id: artistIdValue || '0',
      });

      // Poll for ACTIVE status (max 30 seconds)
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const endpoint = selectedPlan === 'PLATFORM'
          ? '/subscriptions/platform'
          : `/subscriptions/me?artistId=${encodeURIComponent(artistIdValue)}`;
        const sRes = await apiV1.get(endpoint);
        const status = (sRes.data?.subscription?.status ?? '').toString().toUpperCase();
        if (status === 'ACTIVE') break;
        await new Promise(r => setTimeout(r, 2000));
      }

      setPaymentStep('SUCCESS');

      // Auto redirect after success
      setTimeout(() => {
        if (selectedPlan === 'ARTIST' && artistId) {
          navigation.navigate('Artist', { artistId, unlocked: true, contentId });
        } else {
          navigation.goBack();
        }
      }, 2800);

    } catch (err: any) {
      setPaymentStep('PLAN_SELECT');
      setErrorMessage(err?.message || 'Failed to start payment. Please check your connection.');
    } finally {
      setIsCreatingOrder(false);
      setIsVerifyingPayment(false);
    }
  };

  const handleShare = async () => {
    try {
      // Lazy load sharing to prevent crash if native module is not in the current dev client build
      const Sharing = require('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Please capture a screenshot to share your success!');
        return;
      }
      // Note: shareAsync requires a file URI.
      Alert.alert('Success!', 'Ready to share your achievement!');
    } catch (e) {
      console.log('Sharing error:', e);
      Alert.alert('Sharing error', 'Failed to open sharing dialog. Rebuild your dev client to enable this.');
    }
  };

  return (
    <ErrorBoundary label="Payments: Subscription Flow">
      <View style={s.root}>
        {/* ── Rich gradient background ── */}
        <LinearGradient
          colors={['#0A0A1A', '#0F0A2E', '#130820', '#0A0A1A']}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Decorative floating orbs */}
        <FloatingOrbs />

        {/* Subtle mesh overlay */}
        <View style={s.meshOverlay} pointerEvents="none" />

        <SafeAreaView style={s.safe}>
          {/* ══════════════════════════════════════════════════
              PLAN SELECT SCREEN
          ══════════════════════════════════════════════════ */}
          {paymentStep === 'PLAN_SELECT' && (
            <ScrollView
              style={s.scrollWrap}
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                {/* Header */}
                <View style={s.headerWrap}>
                  <View style={s.crownRing}>
                    <LinearGradient colors={['#6C63FF', '#4AA3FF']} style={s.crownGrad}>
                      <Crown color="#fff" size={28} />
                    </LinearGradient>
                  </View>
                  <Text style={s.headline}>Upgrade Your Experience</Text>
                  <Text style={s.subline}>Join thousands of music lovers. Cancel anytime.</Text>
                </View>

                {/* Strong Upsell Alert */}
                {upsellStatus?.showStrongUpsell && (
                  <View style={s.strongUpsellAlert}>
                    <LinearGradient colors={['#FF3D00', '#FF7A18']} style={s.strongUpsellGrad}>
                      <AlertTriangle color="#fff" size={20} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.strongUpsellTitle}>Special Reward Unlocked! 🎁</Text>
                        <Text style={s.strongUpsellDesc}>We noticed you love our content. Subscribe now and get instant access to everything!</Text>
                      </View>
                    </LinearGradient>
                  </View>
                )}

                {/* ── Plan Cards ── */}
                <View style={s.plansWrap}>

                  {/* Platform Plan Card */}
                  <Pressable
                    style={[s.planCard, selectedPlan === 'PLATFORM' && s.planCardActivePlatform]}
                    onPress={() => setSelectedPlan('PLATFORM')}
                    android_ripple={{ color: 'rgba(108,99,255,0.15)' }}
                  >
                    {/* Glow effect */}
                    {selectedPlan === 'PLATFORM' && (
                      <View style={[s.cardGlow, { backgroundColor: 'rgba(108,99,255,0.18)' }]} />
                    )}

                    {/* Popular Badge */}
                    <LinearGradient
                      colors={['#6C63FF', '#4AA3FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.popularBadge}
                    >
                      <Zap color="#fff" size={10} />
                      <Text style={s.popularBadgeText}>  MOST POPULAR</Text>
                    </LinearGradient>

                    <View style={s.cardInner}>
                      {/* Icon + Title + Price row */}
                      <View style={s.cardTopRow}>
                        <LinearGradient colors={['#6C63FF', '#4AA3FF']} style={s.planIconCircle}>
                          <Crown color="#fff" size={22} />
                        </LinearGradient>
                        <View style={s.cardTitleWrap}>
                          <Text style={s.cardTitle}>Platform Plan</Text>
                          <Text style={s.cardSubtitle}>Unlock HD streaming across all content</Text>
                        </View>
                        <View style={s.priceBlock}>
                          {isPlatformConfigLoading ? (
                            <ActivityIndicator color="#6C63FF" size="small" />
                          ) : (
                            <>
                              {hasDiscount && (
                                <Text style={s.priceOriginal}>₹{rawPrice}</Text>
                              )}
                              <Text style={s.priceMain}>{platformPriceDisplay}</Text>
                              <Text style={s.priceSub}>{durationLabel}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      {hasDiscount && (
                        <View style={s.discountRibbon}>
                          <Sparkles color="#6C63FF" size={12} />
                          <Text style={s.discountRibbonText}>  Introductory Offer: Correct price for {discountMonths} month{discountMonths > 1 ? 's' : ''}</Text>
                        </View>
                      )}

                      {/* Divider */}
                      <LinearGradient
                        colors={['transparent', 'rgba(108,99,255,0.4)', 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={s.cardDivider}
                      />

                      {/* Benefits */}
                      {mappedPlatformBenefits.map((b, i) => (
                        <View key={i} style={s.benefitRow}>
                          <View style={[s.checkCircle, { backgroundColor: isPlatform ? 'rgba(108,99,255,0.2)' : 'rgba(255,122,24,0.2)' }]}>
                            <Check color={accentColor} size={12} strokeWidth={3} />
                          </View>
                          <Text style={s.benefitText}>{b.icon}  {b.text}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Selected indicator */}
                    {selectedPlan === 'PLATFORM' && (
                      <View style={[s.selectedDot, { backgroundColor: '#6C63FF' }]}>
                        <Check color="#fff" size={13} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>

                  {/* Artist Plan Card (only if artist context) */}
                  {hasArtist && (
                    <Pressable
                      style={[s.planCard, selectedPlan === 'ARTIST' && s.planCardActiveArtist]}
                      onPress={() => setSelectedPlan('ARTIST')}
                      android_ripple={{ color: 'rgba(255,122,24,0.15)' }}
                    >
                      {selectedPlan === 'ARTIST' && (
                        <View style={[s.cardGlow, { backgroundColor: 'rgba(255,122,24,0.15)' }]} />
                      )}

                      <LinearGradient
                        colors={['#FF7A18', '#FF3D00']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={s.popularBadge}
                      >
                        <Star color="#fff" size={10} />
                        <Text style={s.popularBadgeText}>  ARTIST EXCLUSIVE</Text>
                      </LinearGradient>

                      <View style={s.cardInner}>
                        <View style={s.cardTopRow}>
                          <LinearGradient colors={['#FF7A18', '#FF3D00']} style={s.planIconCircle}>
                            <Star color="#fff" size={22} />
                          </LinearGradient>
                          <View style={s.cardTitleWrap}>
                            <Text style={s.cardTitle}>{artistName}</Text>
                            <Text style={s.cardSubtitle}>Support this artist & unlock exclusive content</Text>
                          </View>
                          <View style={s.priceBlock}>
                            {isArtistProfileLoading ? (
                              <ActivityIndicator color="#FF7A18" size="small" />
                            ) : (
                              <>
                                <Text style={s.priceMain}>{artistPriceDisplay}</Text>
                                <Text style={s.priceSub}>/mo</Text>
                              </>
                            )}
                          </View>
                        </View>

                        <LinearGradient
                          colors={['transparent', 'rgba(255,122,24,0.4)', 'transparent']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={s.cardDivider}
                        />

                        {mappedArtistBenefits.map((b, i) => (
                          <View key={i} style={s.benefitRow}>
                            <View style={[s.checkCircle, { backgroundColor: 'rgba(255,122,24,0.2)' }]}>
                              <Check color="#FF7A18" size={12} strokeWidth={3} />
                            </View>
                            <Text style={s.benefitText}>{b.icon}  {b.text}</Text>
                          </View>
                        ))}
                      </View>

                      {selectedPlan === 'ARTIST' && (
                        <View style={[s.selectedDot, { backgroundColor: '#FF7A18' }]}>
                          <Check color="#fff" size={13} strokeWidth={3} />
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>

                {/* ── Error Display ── */}
                {errorMessage && (
                  <View style={s.errorContainer}>
                    <AlertTriangle color="#EF4444" size={20} />
                    <Text style={s.errorText}>{errorMessage}</Text>
                    <Pressable style={s.errorRetryBtn} onPress={() => setErrorMessage(null)}>
                      <Text style={s.errorRetryText}>Retry</Text>
                    </Pressable>
                  </View>
                )}

                {/* ── CTA Button ── */}
                <Pressable
                  style={[s.ctaWrap, (isCreatingOrder || isVerifyingPayment || isPlatformConfigLoading || (!isPlatform && isArtistProfileLoading)) && { opacity: 0.75 }]}
                  onPress={startPayment}
                  disabled={isCreatingOrder || isVerifyingPayment || isPlatformConfigLoading || (!isPlatform && isArtistProfileLoading)}
                  android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  <LinearGradient
                    colors={isPlatform ? ['#6C63FF', '#4AA3FF'] : ['#FF7A18', '#FF3D00']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.ctaGrad}
                  >
                    {isCreatingOrder ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
                        <Text style={s.ctaText}>Initializing Secure Step...</Text>
                      </View>
                    ) : isPlatformConfigLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
                        <Text style={s.ctaText}>Loading plan details...</Text>
                      </View>
                    ) : (
                      <>
                        <Sparkles color="#fff" size={18} style={{ marginRight: 8 }} />
                        <Text style={s.ctaText}>Subscribe · Pay {priceDisplay}{durationLabel}</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                {/* Trust Badges */}
                <View style={s.trustRow}>
                  <View style={s.trustItem}>
                    <ShieldCheck color="rgba(255,255,255,0.4)" size={14} />
                    <Text style={s.trustItemText}>Razorpay Secure</Text>
                  </View>
                  <View style={s.trustItem}>
                    <Lock color="rgba(255,255,255,0.4)" size={14} />
                    <Text style={s.trustItemText}>SSL Encrypted</Text>
                  </View>
                </View>

                <Text style={s.disclaimer}>
                  Secure payment via Razorpay · Cancel anytime · Auto-renews monthly
                </Text>
              </Animated.View>
            </ScrollView>
          )}

          {/* ══════════════════════════════════════════════════
              PROCESSING SCREEN
          ══════════════════════════════════════════════════ */}
          {paymentStep === 'PROCESSING' && (
            <View style={s.centeredWrap}>
              <BlurView intensity={20} tint="dark" style={s.processingCard}>
                <ActivityIndicator color="#6C63FF" size="large" />
                <Text style={s.processingTitle}>Activating Subscription</Text>
                <Text style={s.processingDesc}>{processingMessage}</Text>
              </BlurView>
            </View>
          )}

          {/* ══════════════════════════════════════════════════
              SUCCESS SCREEN
          ══════════════════════════════════════════════════ */}
          {paymentStep === 'SUCCESS' && (
            <View style={s.centeredWrap}>
              <Animated.View style={{ opacity: fadeAnim }}>
                <View style={s.successIconWrap}>
                  <LinearGradient colors={['#10B981', '#059669']} style={s.successIconGrad}>
                    <BadgeCheck color="#fff" size={40} />
                  </LinearGradient>
                </View>
                <Text style={s.successTitle}>You're all set! 🎉</Text>
                <Text style={s.successSub}>
                  Your {planLabel} is now active.{'\n'}Enjoy your premium experience!
                </Text>
                <View style={s.successBadge}>
                  <Sparkles color="#10B981" size={14} />
                  <Text style={s.successBadgeText}>  Premium features unlocked</Text>
                </View>

                <Pressable 
                  style={s.shareBtn} 
                  onPress={handleShare}
                >
                  <Share2 color="#fff" size={18} style={{ marginRight: 8 }} />
                  <Text style={s.shareBtnText}>Share Success</Text>
                </Pressable>

                <Text style={s.successRedirect}>Redirecting you back…</Text>
              </Animated.View>
            </View>
          )}
        </SafeAreaView>

        {/* ── Final Top-Level Close Button ── */}
        {paymentStep !== 'SUCCESS' && (
          <Pressable 
            style={[s.closeBtn, { top: insets.top + 10 }]}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <View style={s.closeBtnInner}>
              <X color="#fff" size={22} />
            </View>
          </Pressable>
        )}
      </View>
    </ErrorBoundary>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A1A' },
  safe: { flex: 1 },

  meshOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    backgroundColor: '#fff',
  },

  // Orbs
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: {
    width: 320, height: 320,
    top: -100, left: -80,
    backgroundColor: 'rgba(108,99,255,0.28)',
  },
  orb2: {
    width: 260, height: 260,
    top: SH * 0.25, right: -100,
    backgroundColor: 'rgba(74,163,255,0.22)',
  },
  orb3: {
    width: 240, height: 240,
    bottom: 40, left: -40,
    backgroundColor: 'rgba(255,122,24,0.15)',
  },

  // Close
  closeBtn: { 
    position: 'absolute', 
    left: 16, 
    zIndex: 999 
  },
  closeBtnInner: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Scroll
  scrollWrap: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Header
  headerWrap: { alignItems: 'center', marginBottom: 30 },
  crownRing: {
    width: 72, height: 72,
    borderRadius: 36,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.5)',
    marginBottom: 16,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  crownGrad: {
    flex: 1,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 10,
  },
  subline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Plan cards
  plansWrap: { gap: 16, marginBottom: 24 },
  planCard: {
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  planCardActivePlatform: {
    borderColor: '#6C63FF',
    backgroundColor: 'rgba(108,99,255,0.12)',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  planCardActiveArtist: {
    borderColor: '#FF7A18',
    backgroundColor: 'rgba(255,122,24,0.1)',
    shadowColor: '#FF7A18',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  cardGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 100,
    borderRadius: 22,
  },

  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomRightRadius: 16,
    marginLeft: 0,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  cardInner: { padding: 18, paddingTop: 12 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  planIconCircle: {
    width: 48, height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  priceBlock: { alignItems: 'flex-end' },
  priceMain: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  priceSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
  },

  cardDivider: {
    height: 1,
    marginBottom: 14,
  },

  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  checkCircle: {
    width: 22, height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  benefitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },

  selectedDot: {
    position: 'absolute',
    top: 12, right: 14,
    width: 26, height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  ctaWrap: {
    height: 58,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },

  // Processing & Success shared
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  processingCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  processingTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 8,
  },
  processingDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Success
  successIconWrap: {
    alignSelf: 'center',
    width: 88, height: 88,
    borderRadius: 44,
    padding: 4,
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.5)',
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
  },
  successIconGrad: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  successSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  successBadgeText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  successRedirect: {
    marginTop: 20,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  errorRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  errorRetryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustItemText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  strongUpsellAlert: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,61,0,0.3)',
    shadowColor: '#FF3D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  strongUpsellGrad: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  strongUpsellTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  strongUpsellDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
  },
  priceOriginal: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginBottom: -4,
  },
  discountRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  discountRibbonText: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '800',
  },
});
