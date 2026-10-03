import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock3,
  Lock,
  ShieldCheck,
  Star,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { apiV1, normalizeApiError } from "../services/api";
import { userService } from "../services/userService";
import ErrorBoundary from "../ui/ErrorBoundary";
import logger from "../utils/logger";

type PaymentStep = "OFFER" | "PREPARING" | "PROCESSING" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";

type RouteParams = {
  artistId?: string | number;
  artistName?: string;
  contentId?: string | number;
  artwork?: string;
};

type PurchaseResponse = {
  success: boolean;
  subscription: {
    id: number;
    artistId: number;
    artistName: string;
    status: "PENDING";
  };
  order: {
    id: string;
    amount: number;
    currency: string;
    key_id: string;
  };
};

type PurchaseStatusResponse = {
  success: boolean;
  subscription: {
    id: number;
    artistId: number;
    artistName: string;
    status: string;
    expiresAt?: string | null;
  };
  payment?: {
    status: string;
    failureReason?: string | null;
  } | null;
};

const POLL_INTERVAL_MS = 2_000;
const INITIAL_CONFIRMATION_WINDOW_MS = 45_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatPriceFromPaise(amountPaise: number, currency = "INR") {
  const amount = amountPaise / 100;
  if (currency.toUpperCase() === "INR") {
    return `₹${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
  }
  return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
}

export default function SubscriptionFlowScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const params: RouteParams = route?.params ?? {};
  const artistId = useMemo(() => Number(params.artistId), [params.artistId]);
  const contentId = params.contentId;

  const [artistName, setArtistName] = useState(
    String(params.artistName || "Artist")
  );
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [step, setStep] = useState<PaymentStep>("OFFER");
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [lastKnownExpiry, setLastKnownExpiry] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const pollingGeneration = useRef(0);

  const hasValidArtist = Number.isSafeInteger(artistId) && artistId > 0;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  useEffect(() => {
    let cancelled = false;

    const loadArtist = async () => {
      if (!hasValidArtist) {
        setErrorMessage("Artist information is missing. Please return and try again.");
        setIsProfileLoading(false);
        return;
      }

      setIsProfileLoading(true);
      try {
        const profile = await userService.getArtistProfile(artistId);
        if (cancelled) return;

        if (!profile) {
          setErrorMessage("Unable to load this artist's subscription details.");
          return;
        }

        setArtistName(profile.name || artistName);
        const price = Number(profile.subscriptionPrice);
        setDisplayPrice(Number.isFinite(price) && price > 0 ? price : null);
        if (!Number.isFinite(price) || price <= 0) {
          setErrorMessage("This artist is not currently accepting subscriptions.");
        }
      } catch (err: any) {
        if (!cancelled) {
          const normalized = normalizeApiError(err);
          setErrorMessage(normalized.message || "Unable to load subscription details. Please try again.");
        }
      } finally {
        if (!cancelled) setIsProfileLoading(false);
      }
    };

    void loadArtist();
    return () => {
      cancelled = true;
      pollingGeneration.current += 1;
    };
  }, [artistId, artistName, hasValidArtist]);

  const fetchStatus = async (id: number): Promise<PurchaseStatusResponse> => {
    const response = await apiV1.get(`/subscriptions/${id}`);
    return response.data as PurchaseStatusResponse;
  };

  const applyTerminalStatus = (status: PurchaseStatusResponse) => {
    const subscriptionStatus = String(status.subscription?.status || "").toUpperCase();
    const paymentStatus = String(status.payment?.status || "").toUpperCase();

    if (subscriptionStatus === "ACTIVE") {
      setLastKnownExpiry(status.subscription?.expiresAt || null);
      setStep("SUCCESS");
      setFailureReason(null);
      return true;
    }

    if (paymentStatus === "FAILED") {
      setFailureReason(
        status.payment?.failureReason || "The payment was not completed."
      );
      setStep("FAILED");
      return true;
    }

    return false;
  };

  const pollUntilSettled = async (
    id: number,
    windowMs = INITIAL_CONFIRMATION_WINDOW_MS
  ) => {
    const generation = ++pollingGeneration.current;
    const deadline = Date.now() + windowMs;

    while (Date.now() < deadline && generation === pollingGeneration.current) {
      try {
        const status = await fetchStatus(id);
        if (generation !== pollingGeneration.current) return;
        if (applyTerminalStatus(status)) return;
      } catch (error: any) {
        logger.warn(
          "[SubscriptionFlow] status poll failed",
          error?.response?.status || error?.message
        );
      }

      await sleep(POLL_INTERVAL_MS);
    }

    if (generation === pollingGeneration.current) {
      setStep("PENDING");
    }
  };

  const startPayment = async () => {
    if (isStarting || !hasValidArtist) return;

    setErrorMessage(null);
    setFailureReason(null);
    setIsStarting(true);

    try {
      const response = await apiV1.post<PurchaseResponse>("/subscriptions", {
        artistId,
      });
      const purchase = response.data;
      const id = Number(purchase?.subscription?.id);
      const orderId = String(purchase?.order?.id || "").trim();
      const amount = Number(purchase?.order?.amount);
      const currency = String(purchase?.order?.currency || "INR").toUpperCase();
      const key = String(
        purchase?.order?.key_id || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || ""
      ).trim();

      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !orderId ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !key
      ) {
        throw new Error("The server returned an invalid payment order.");
      }

      setSubscriptionId(id);
      setArtistName(purchase.subscription.artistName || artistName);
      setDisplayPrice(amount / 100);

      if (Platform.OS === "web") {
        Alert.alert(
          "Subscription Order Created (₹49)",
          `Order ${orderId} has been successfully created on the backend! In web browser preview, native Razorpay popup is mobile-only. The server has registered this subscription intent.`,
          [
            {
              text: "OK",
              onPress: () => {
                if (navigation.canGoBack()) navigation.goBack();
              },
            },
          ]
        );
        return;
      }

      let gatewayResult: any;
      setStep("PREPARING");
      try {
        gatewayResult = await RazorpayCheckout.open({
          key,
          amount,
          currency,
          name: "Music Platform",
          description: `Monthly subscription · ${purchase.subscription.artistName}`,
          order_id: orderId,
          notes: {
            subscription_id: String(id),
            artist_id: String(purchase.subscription.artistId),
          },
          theme: { color: "#FF7A18" },
        } as any);
      } catch (error: any) {
        const text = String(
          error?.description || error?.error?.description || error?.message || ""
        );

        // Cancellation is not payment truth. Do not tell the backend to mark a
        // transaction failed; Razorpay webhook/reconciliation owns that state.
        if (/cancel/i.test(text) || text.includes("payment_error")) {
          setStep("CANCELLED");
          return;
        }
        throw error;
      }

      logger.log("[SubscriptionFlow] gateway returned", {
        orderId: gatewayResult?.razorpay_order_id || orderId,
        hasPaymentId: Boolean(gatewayResult?.razorpay_payment_id),
      });

      // The SDK callback is only a signal that checkout returned. It is NOT
      // sufficient to unlock content. Verified webhook state remains authoritative.
      setStep("PROCESSING");
      await pollUntilSettled(id);
    } catch (error: any) {
      const normalized = normalizeApiError(error);
      const message =
        normalized.message ||
        "Unable to start subscription. Please try again.";
      // ONE clean presentation via existing UI error state per Phase 3 & 4
      setErrorMessage(String(message));
      setStep("OFFER");
    } finally {
      setIsStarting(false);
    }
  };

  const checkAgain = async () => {
    if (!subscriptionId) {
      setStep("OFFER");
      return;
    }

    setStep("PROCESSING");
    try {
      const status = await fetchStatus(subscriptionId);
      if (applyTerminalStatus(status)) return;
      await pollUntilSettled(subscriptionId, 20_000);
    } catch (error: any) {
      const normalized = normalizeApiError(error);
      setErrorMessage(
        normalized.message ||
          "We couldn't refresh payment status. Please try again."
      );
      setStep("PENDING");
    }
  };

  const goToArtist = () => {
    navigation.navigate("Artist", {
      artistId: String(artistId),
      contentId,
    });
  };

  const close = () => {
    pollingGeneration.current += 1;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  };

  const offerPrice = displayPrice
    ? `₹${Number.isInteger(displayPrice) ? displayPrice.toFixed(0) : displayPrice.toFixed(2)}`
    : "—";

  return (
    <ErrorBoundary label="Payments: Artist Subscription">
      <View style={styles.root}>
        <LinearGradient
          colors={["#080808", "#15100D", "#080808"]}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.safe}>
          {step === "OFFER" && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: fade }}>
                <View style={styles.heroIcon}>
                  <Star color="#fff" size={28} fill="#fff" />
                </View>
                <Text style={styles.eyebrow}>EARLY ACCESS MEMBERSHIP</Text>
                <Text style={styles.title}>Support {artistName}</Text>
                <Text style={styles.subtitle}>
                  Get 30 days of access to this artist's subscriber-only early releases.
                </Text>

                <View style={styles.card}>
                  <View style={styles.priceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Monthly Artist Access</Text>
                      <Text style={styles.cardSub}>Fixed 30-day access · manual renewal</Text>
                    </View>
                    {isProfileLoading ? (
                      <ActivityIndicator color="#FF7A18" />
                    ) : (
                      <View style={styles.priceBlock}>
                        <Text style={styles.price}>{offerPrice}</Text>
                        <Text style={styles.perMonth}>/30 days</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.divider} />
                  {[
                    "Early access to subscriber releases",
                    "Exclusive artist content",
                    "Directly support the artist",
                    "No automatic renewal in Phase 1",
                  ].map((item) => (
                    <View key={item} style={styles.benefitRow}>
                      <View style={styles.checkCircle}>
                        <Check color="#FF7A18" size={13} strokeWidth={3} />
                      </View>
                      <Text style={styles.benefitText}>{item}</Text>
                    </View>
                  ))}
                </View>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <AlertTriangle color="#EF4444" size={18} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                <Pressable
                  onPress={startPayment}
                  disabled={isStarting || isProfileLoading || !displayPrice}
                  style={[
                    styles.ctaWrap,
                    (isStarting || isProfileLoading || !displayPrice) && styles.disabled,
                  ]}
                >
                  <LinearGradient
                    colors={["#FF7A18", "#FF3D00"]}
                    style={styles.cta}
                  >
                    {isStarting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Lock color="#fff" size={18} />
                        <Text style={styles.ctaText}>Subscribe · {offerPrice}</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <View style={styles.trustRow}>
                  <ShieldCheck color="rgba(255,255,255,0.48)" size={15} />
                  <Text style={styles.trustText}>
                    Secure Razorpay checkout · Access unlocks only after server confirmation
                  </Text>
                </View>
              </Animated.View>
            </ScrollView>
          )}

          {step === "PREPARING" && (
            <View style={styles.centered}>
              <View style={styles.preparingHeader}>
                <ShieldCheck color="#3B82F6" size={18} />
                <Text style={styles.preparingBrand}>Secured by Razorpay</Text>
              </View>
              <ActivityIndicator color="#3B82F6" size="large" style={{ marginVertical: 28 }} />
              <Text style={styles.stateTitle}>Preparing Payment</Text>
              <Text style={styles.stateBody}>
                Please wait while we open Razorpay securely...
              </Text>
              <View style={[styles.trustRow, { marginTop: 36 }]}>
                <ShieldCheck color="rgba(255,255,255,0.48)" size={15} />
                <Text style={styles.trustText}>
                  Your payment is safe and secure with Razorpay.
                </Text>
              </View>
            </View>
          )}

          {step === "PROCESSING" && (
            <View style={styles.centered}>
              <ActivityIndicator color="#FF7A18" size="large" style={{ marginVertical: 20 }} />
              <Text style={styles.stateTitle}>Confirming payment…</Text>
              <Text style={styles.stateBody}>
                Payment was returned by the gateway. We're waiting for verified server confirmation before unlocking content.
              </Text>
              <Pressable
                style={[styles.secondaryButton, { marginTop: 24 }]}
                onPress={() => {
                  pollingGeneration.current += 1;
                  setStep("OFFER");
                  if (navigation.canGoBack()) navigation.goBack();
                }}
              >
                <Text style={styles.secondaryButtonText}>Return</Text>
              </Pressable>
            </View>
          )}

          {step === "PENDING" && (
            <View style={styles.centered}>
              <View style={[styles.statusIconCircle, { backgroundColor: "rgba(245,158,11,0.15)", borderColor: "rgba(245,158,11,0.3)" }]}>
                <Clock3 color="#F59E0B" size={36} />
              </View>
              <Text style={styles.stateTitle}>Payment Verification Pending</Text>
              <Text style={styles.stateBody}>
                Your payment was received. We're still verifying it. This may take a few minutes.
              </Text>
              <View style={styles.twoButtonRow}>
                <Pressable style={[styles.actionBtnHalf, { backgroundColor: "#FFB608" }]} onPress={checkAgain}>
                  <Text style={[styles.actionBtnText, { color: "#000" }]}>Check Status</Text>
                </Pressable>
                <Pressable style={[styles.actionBtnHalf, styles.actionBtnSecondary]} onPress={close}>
                  <Text style={styles.actionBtnText}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "FAILED" && (
            <View style={styles.centered}>
              <View style={[styles.statusIconCircle, { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)" }]}>
                <X color="#EF4444" size={36} strokeWidth={2.5} />
              </View>
              <Text style={styles.stateTitle}>Payment Failed</Text>
              <Text style={styles.stateBody}>
                {failureReason || "We couldn't complete your payment. Please try again."}
              </Text>
              <View style={styles.twoButtonRow}>
                <Pressable
                  style={[styles.actionBtnHalf, { backgroundColor: "#EF4444" }]}
                  onPress={() => void startPayment()}
                >
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Try Again</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtnHalf, styles.actionBtnSecondary]}
                  onPress={() => {
                    setFailureReason(null);
                    setErrorMessage(null);
                    setStep("OFFER");
                  }}
                >
                  <Text style={styles.actionBtnText}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "CANCELLED" && (
            <View style={styles.centered}>
              <View style={[styles.statusIconCircle, { backgroundColor: "rgba(156,163,175,0.15)", borderColor: "rgba(156,163,175,0.3)" }]}>
                <X color="#9CA3AF" size={36} strokeWidth={2} />
              </View>
              <Text style={styles.stateTitle}>Payment Cancelled</Text>
              <Text style={styles.stateBody}>
                No payment was completed. You can try again whenever you're ready.
              </Text>
              <View style={styles.twoButtonRow}>
                <Pressable style={[styles.actionBtnHalf, { backgroundColor: "#3B82F6" }]} onPress={() => void startPayment()}>
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Try Again</Text>
                </Pressable>
                <Pressable style={[styles.actionBtnHalf, styles.actionBtnSecondary]} onPress={() => setStep("OFFER")}>
                  <Text style={styles.actionBtnText}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "SUCCESS" && (
            <View style={styles.centered}>
              <View style={[styles.statusIconCircle, { backgroundColor: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.3)" }]}>
                <Check color="#10B981" size={38} strokeWidth={3} />
              </View>
              <Text style={styles.stateTitle}>Payment Successful</Text>
              <Text style={styles.stateBody}>
                Your artist access has been activated successfully.
              </Text>
              <View style={styles.successReceiptCard}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Amount</Text>
                  <Text style={styles.receiptValue}>{offerPrice}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Artist</Text>
                  <Text style={styles.receiptValue}>{artistName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Valid till</Text>
                  <Text style={styles.receiptValue}>
                    {lastKnownExpiry
                      ? new Date(lastKnownExpiry).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                      : new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>
              <Pressable style={styles.continueBtn} onPress={goToArtist}>
                <Text style={styles.continueBtnText}>Continue</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>

        {step !== "SUCCESS" && step !== "PROCESSING" && (
          <Pressable
            style={[styles.closeButton, { top: insets.top + 8 }]}
            onPress={close}
            hitSlop={16}
          >
            <X color="#fff" size={22} />
          </Pressable>
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  safe: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 40 },
  closeButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FF6A00",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  eyebrow: {
    color: "#FF7A18",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,122,24,0.25)",
  },
  priceRow: { flexDirection: "row", alignItems: "center" },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  cardSub: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    marginTop: 5,
  },
  priceBlock: { alignItems: "flex-end", marginLeft: 12 },
  price: { color: "#fff", fontSize: 28, fontWeight: "900" },
  perMonth: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.09)",
    marginVertical: 18,
  },
  benefitRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,122,24,0.13)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  benefitText: { color: "rgba(255,255,255,0.78)", fontSize: 14, flex: 1 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
  },
  errorText: { color: "#FCA5A5", fontSize: 13, flex: 1, marginLeft: 9 },
  ctaWrap: { borderRadius: 16, overflow: "hidden", marginTop: 20 },
  cta: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 8,
  },
  trustText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    marginLeft: 7,
    textAlign: "center",
    flexShrink: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  stateTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 20,
  },
  stateBody: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 420,
  },
  pendingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  failedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineError: {
    color: "#FCA5A5",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 24,
  },
  secondaryButtonText: { color: "#111", fontSize: 15, fontWeight: "900" },
  textButton: { padding: 14, marginTop: 5 },
  textButtonText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
  successButton: {
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 24,
  },
  successButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  statusIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  twoButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
    width: "100%",
    maxWidth: 340,
  },
  actionBtnHalf: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  successReceiptCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
    marginBottom: 8,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  receiptLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    fontWeight: "500",
  },
  receiptValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  continueBtn: {
    width: "100%",
    maxWidth: 340,
    height: 52,
    backgroundColor: "#FFB608",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  continueBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
  },
  preparingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  preparingBrand: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  expiryText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 12,
  },
});
