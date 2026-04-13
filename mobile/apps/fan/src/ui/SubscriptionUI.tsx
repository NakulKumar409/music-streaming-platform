import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Lock, Crown, Award, AlertTriangle, RefreshCw, 
  X, CreditCard, ShieldCheck, Check, Star 
} from 'lucide-react-native';
import { Modal, ScrollView, Switch } from 'react-native';
import type { SubscriptionRecord } from '../services/userService';

// ─────────────────────────────────────────────────────
// LockedContentOverlay — shown over locked artist content
// ─────────────────────────────────────────────────────
type LockedContentOverlayProps = {
  artistName?: string;
  reason?: string; // 'NO_SUBSCRIPTION' | 'EXPIRED' | 'ERROR'
  onSubscribe: () => void;
  previewSeconds?: number; // seconds of free preview (default 10)
};

export function LockedContentOverlay({
  artistName,
  reason,
  onSubscribe,
  previewSeconds = 10,
}: LockedContentOverlayProps) {
  const headingText =
    reason === 'EXPIRED'
      ? '🔒 Subscription Expired'
      : '🔒 Premium Content';

  const bodyText =
    reason === 'EXPIRED'
      ? `Your subscription to ${artistName ?? 'this artist'} has expired. Renew to continue listening.`
      : `This content is available only for ${artistName ?? 'artist'} subscribers. Preview: ${previewSeconds} sec free.`;

  const btnLabel = reason === 'EXPIRED' ? 'Renew Subscription' : 'Subscribe to Artist';

  return (
    <View style={lockedStyles.backdrop}>
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={lockedStyles.card}>
        <View style={lockedStyles.iconRow}>
          <Lock color="#FF7A18" size={26} />
        </View>
        <Text style={lockedStyles.heading}>{headingText}</Text>
        <Text style={lockedStyles.body}>{bodyText}</Text>
        <Pressable style={lockedStyles.btn} onPress={onSubscribe}>
          <LinearGradient
            colors={['#FF7A18', '#FF3D00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={lockedStyles.btnInner}
          >
            <Text style={lockedStyles.btnText}>{btnLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// QualityLockBanner — shown when user tries to pick HD
// ─────────────────────────────────────────────────────
type QualityLockBannerProps = {
  onUpgrade: () => void;
};

export function QualityLockBanner({ onUpgrade }: QualityLockBannerProps) {
  return (
    <View style={qualityStyles.container}>
      <Crown color="#4AA3FF" size={22} />
      <View style={qualityStyles.textWrap}>
        <Text style={qualityStyles.title}>🔒 HD Quality Locked</Text>
        <Text style={qualityStyles.sub}>
          Upgrade to Platform Plan to watch in 720p / 1080p
        </Text>
      </View>
      <Pressable style={qualityStyles.btn} onPress={onUpgrade}>
        <Text style={qualityStyles.btnText}>Upgrade Now</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// SubscriptionStatusCard — shown in Account / Artist pages
// ─────────────────────────────────────────────────────
type SubscriptionStatusCardProps = {
  plan: SubscriptionRecord;
  onRenew?: () => void;
  onManage?: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10B981',
  GRACE: '#F59E0B',
  PAST_DUE: '#F59E0B',
  EXPIRED: '#EF4444',
  CANCELLED: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  GRACE: 'Grace Period',
  PAST_DUE: 'Payment Due',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  CREATED: 'Pending',
};

export function SubscriptionStatusCard({ plan, onRenew, onManage }: SubscriptionStatusCardProps) {
  const status = (plan.status ?? '').toUpperCase();
  const statusColor = STATUS_COLORS[status] ?? '#6B7280';
  const statusLabel = STATUS_LABELS[status] ?? plan.status;

  const formattedEnd = useMemo(() => {
    const raw = plan.endDate ?? plan.nextBillingDate;
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }, [plan.endDate, plan.nextBillingDate]);

  const isExpiringSoon = plan.isExpiringSoon;
  const daysLeft = plan.daysLeft;
  const isPlatform = plan.type === 'PLATFORM';

  return (
    <View style={cardStyles.container}>
      {/* Header row */}
      <View style={cardStyles.headerRow}>
        <View style={[cardStyles.planIconWrap, isPlatform && cardStyles.platformIconWrap]}>
          {isPlatform ? (
            <Crown color="#4AA3FF" size={18} />
          ) : (
            <Award color="#FF7A18" size={18} />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={cardStyles.planTitle}>
            {isPlatform ? 'Platform Plan' : `Artist Plan${plan.artistName ? ` — ${plan.artistName}` : ''}`}
          </Text>
          <Text style={cardStyles.planType}>{plan.planType ?? 'MONTHLY'}</Text>
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
          <View style={[cardStyles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[cardStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Expiry info */}
      <View style={cardStyles.expiryRow}>
        <Text style={cardStyles.expiryLabel}>
          {status === 'ACTIVE' ? 'Renews on' : 'Expired on'}
        </Text>
        <Text style={cardStyles.expiryValue}>{formattedEnd}</Text>
      </View>

      {/* Expiry warning */}
      {isExpiringSoon && status === 'ACTIVE' && (
        <View style={cardStyles.warningRow}>
          <AlertTriangle color="#F59E0B" size={14} />
          <Text style={cardStyles.warningText}>
            Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} — Renew now to avoid losing access
          </Text>
        </View>
      )}

      {/* Grace period notice */}
      {(status === 'GRACE' || status === 'PAST_DUE') && (
        <View style={[cardStyles.warningRow, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
          <AlertTriangle color="#F59E0B" size={14} />
          <Text style={cardStyles.warningText}>
            Grace period active — Please renew to restore full access
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={cardStyles.btnRow}>
        {status !== 'ACTIVE' || isExpiringSoon ? (
          <Pressable style={cardStyles.renewBtn} onPress={onRenew}>
            <LinearGradient
              colors={['#FF7A18', '#FF3D00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={cardStyles.renewBtnInner}
            >
              <RefreshCw color="#fff" size={14} style={{ marginRight: 6 }} />
              <Text style={cardStyles.renewBtnText}>
                {isExpiringSoon ? 'Renew Early' : 'Renew Now'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}
        {onManage && (
          <Pressable style={cardStyles.manageBtn} onPress={onManage}>
            <Text style={cardStyles.manageBtnText}>Manage</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// Redesign Components
// ─────────────────────────────────────────────────────

export function DetailedPlatformCard({ plan, onManage, onUpgrade }: { plan: SubscriptionRecord | null, onManage: () => void, onUpgrade: () => void }) {
  if (!plan) return null;
  const status = (plan.status ?? '').toUpperCase();
  const statusColor = STATUS_COLORS[status] ?? '#6B7280';
  const statusLabel = STATUS_LABELS[status] ?? plan.status;

  const expiryDate = plan.endDate ?? plan.nextBillingDate;
  const formattedExpiry = expiryDate ? new Date(expiryDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  
  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.headerRow}>
        <View style={[cardStyles.planIconWrap, cardStyles.platformIconWrap]}>
          <Crown color="#4AA3FF" size={24} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[cardStyles.planTitle, { fontSize: 18 }]}>Platform Plan</Text>
          <Text style={cardStyles.planType}>{plan.planType} • ₹{plan.price || 99}/{plan.planType === 'YEARLY' ? 'year' : 'month'}</Text>
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
          <Text style={[cardStyles.statusText, { color: statusColor, fontSize: 11 }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={cardStyles.detailsGrid}>
        <View style={cardStyles.detailItem}>
          <Text style={cardStyles.detailLabel}>Next Billing</Text>
          <Text style={cardStyles.detailValue}>{formattedExpiry}</Text>
        </View>
        <View style={cardStyles.detailItem}>
          <Text style={cardStyles.detailLabel}>Billing Cycle</Text>
          <Text style={cardStyles.detailValue}>{plan.planType}</Text>
        </View>
      </View>

      <View style={cardStyles.benefitsList}>
        {(plan.features || ["HD streaming", "Ad-free experience", "Unlimited skips"]).slice(0, 3).map((f, i) => (
          <View key={i} style={cardStyles.benefitListItem}>
            <Text style={cardStyles.benefitTick}>✓</Text>
            <Text style={cardStyles.benefitListText}>{f}</Text>
          </View>
        ))}
      </View>

      <View style={cardStyles.btnRow}>
        <Pressable style={[cardStyles.manageBtn, { flex: 1, height: 48 }]} onPress={onManage}>
          <Text style={cardStyles.manageBtnText}>Manage Plan</Text>
        </Pressable>
        {status !== 'ACTIVE' && (
          <Pressable style={[cardStyles.renewBtn, { flex: 1, height: 48 }]} onPress={onUpgrade}>
             <LinearGradient colors={['#FF7A18', '#FF3D00']} style={cardStyles.renewBtnInner}>
               <Text style={cardStyles.renewBtnText}>Upgrade</Text>
             </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ArtistSubscriptionItem({ sub, onPress }: { sub: SubscriptionRecord, onPress: () => void }) {
  const status = (sub.status ?? '').toUpperCase();
  const statusColor = STATUS_COLORS[status] ?? '#6B7280';
  const expiryDate = sub.endDate ?? sub.nextBillingDate;
  const formattedExpiry = expiryDate ? new Date(expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

  return (
    <Pressable style={cardStyles.artistItem} onPress={onPress}>
      <View style={cardStyles.artistAvatarWrap}>
        <Award color="#FF7A18" size={20} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={cardStyles.artistName}>{sub.artistName || 'Artist'}</Text>
        <Text style={cardStyles.artistSubInfo}>
          {sub.planType} • ₹{sub.price}/{sub.planType === 'YEARLY' ? 'yr' : 'mo'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[cardStyles.statusBadge, { paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, backgroundColor: `${statusColor}15`, borderColor: `${statusColor}40` }]}>
          <Text style={[cardStyles.statusText, { color: statusColor, fontSize: 10 }]}>{status}</Text>
        </View>
        <Text style={cardStyles.artistExpiry}>Ends {formattedExpiry}</Text>
      </View>
    </Pressable>
  );
}

export function EmptySubscriptionState({ onExplore }: { onExplore: () => void }) {
  return (
    <View style={cardStyles.emptyContainer}>
      <View style={cardStyles.emptyIconWrap}>
        <Crown color="rgba(255,255,255,0.2)" size={48} />
      </View>
      <Text style={cardStyles.emptyTitle}>You're not subscribed yet</Text>
      <Text style={cardStyles.emptySub}>Unlock premium quality, exclusive artist content, and an ad-free experience.</Text>
      <Pressable style={cardStyles.exploreBtn} onPress={onExplore}>
        <LinearGradient colors={['#FF7A18', '#FF3D00']} style={cardStyles.exploreBtnInner}>
          <Text style={cardStyles.exploreBtnText}>Explore Plans</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export function TransactionRow({ tx, onDownload }: { tx: any, onDownload: () => void }) {
  const date = new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  const status = tx.status?.toUpperCase() || 'PENDING';
  const isSuccess = status === 'CAPTURED' || status === 'SUCCESS';
  const isFailed = status === 'FAILED' || status === 'CANCELLED';
  const isPending = status === 'CREATED' || status === 'PENDING';
  
  // Status colors
  const statusColor = isSuccess ? '#10B981' : isFailed ? '#EF4444' : '#F59E0B';
  const statusLabel = isSuccess ? 'Success' : isFailed ? (status === 'CANCELLED' ? 'Cancelled' : 'Failed') : 'Pending';
  
  return (
    <View style={[cardStyles.txRow, isFailed && { opacity: 0.7 }]}>
      <View style={cardStyles.txDateBlock}>
        <Text style={cardStyles.txDay}>{new Date(tx.date).getDate()}</Text>
        <Text style={cardStyles.txMonth}>{new Date(tx.date).toLocaleString('default', { month: 'short' })}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text style={[cardStyles.txTitle, isFailed && { textDecorationLine: 'line-through' }]}>
          {tx.artistName || 'Platform Plan'}
        </Text>
        <Text style={cardStyles.txId}>ID: {tx.razorpayPaymentId || tx.id}</Text>
        {/* Status Badge */}
        <View style={[cardStyles.txStatusBadge, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
          <View style={[cardStyles.txStatusDot, { backgroundColor: statusColor }]} />
          <Text style={[cardStyles.txStatusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[cardStyles.txAmount, isFailed && { textDecorationLine: 'line-through' }]}>₹{tx.amount / 100}</Text>
        {/* Only show invoice for successful payments */}
        {isSuccess && (
          <Pressable onPress={onDownload} style={cardStyles.txInvoice}>
            <Text style={cardStyles.txInvoiceText}>Invoice ↓</Text>
          </Pressable>
        )}
        {isFailed && (
          <Text style={[cardStyles.txFailedText, { color: statusColor }]}>Payment Failed</Text>
        )}
      </View>
    </View>
  );
}

// ── NEW: Cancellation & Retention UI (Phase 1) ──────────────────────────

export function AutoRenewToggle({ enabled, onToggle, loading }: { enabled: boolean, onToggle: (val: boolean) => void, loading?: boolean }) {
  return (
    <View style={mgStyles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={mgStyles.toggleTitle}>Auto-Renewal</Text>
        <Text style={mgStyles.toggleSub}>
          {enabled ? 'Your plan will automatically renew on the next billing date.' : 'Your plan will expire at the end of the current cycle.'}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: '#10B981' }}
        thumbColor={enabled ? '#fff' : '#888'}
        disabled={loading}
      />
    </View>
  );
}

const CANCEL_REASONS = [
  { id: 'expensive', label: 'Too expensive', icon: 'CreditCard' },
  { id: 'unused', label: 'Not using it enough', icon: 'RefreshCw' },
  { id: 'content', label: 'Missing specific content', icon: 'Star' },
  { id: 'other', label: 'Other reasons', icon: 'Check' },
];

export function CancellationFlow({
  visible,
  onClose,
  onConfirm,
  planName,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string, acceptedOffer: boolean) => void;
  planName: string;
}) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [reason, setReason] = React.useState('');

  const handleNext = (r: string) => {
    setReason(r);
    setStep(2);
  };

  const handleConfirmCancel = () => {
    onConfirm(reason, false);
    onClose();
  };

  const handleAcceptOffer = () => {
    onConfirm(reason, true);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={mgStyles.modalBackdrop}>
        <View style={mgStyles.modalContent}>
          {/* Header */}
          <View style={mgStyles.modalHeader}>
            <Text style={mgStyles.modalTitle}>Cancel Subscription</Text>
            <Pressable onPress={onClose} style={mgStyles.closeBtn}>
              <X color="#fff" size={20} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 500 }}>
            {step === 1 && (
              <View style={mgStyles.stepContainer}>
                <Text style={mgStyles.stepHeading}>We're sorry to see you go</Text>
                <Text style={mgStyles.stepSub}>Please let us know why you're cancelling {planName}:</Text>
                {CANCEL_REASONS.map((r) => (
                  <Pressable key={r.id} style={mgStyles.reasonBtn} onPress={() => handleNext(r.id)}>
                    <View style={mgStyles.reasonIconWrap}>
                      {r.id === 'expensive' && <CreditCard color="#FF7A18" size={18} />}
                      {r.id === 'unused' && <RefreshCw color="#FF7A18" size={18} />}
                      {r.id === 'content' && <Star color="#FF7A18" size={18} />}
                      {r.id === 'other' && <Check color="#FF7A18" size={18} />}
                    </View>
                    <Text style={mgStyles.reasonLabel}>{r.label}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {step === 2 && (
              <View style={mgStyles.stepContainer}>
                <View style={mgStyles.offerCard}>
                  <LinearGradient colors={['#FF7A1833', '#FF3D0022']} style={StyleSheet.absoluteFill} />
                  <Award color="#FF7A18" size={48} style={{ marginBottom: 16 }} />
                  <Text style={mgStyles.offerTitle}>Wait! Don't miss out</Text>
                  <Text style={mgStyles.offerSub}>
                    Get <Text style={{ color: '#FF7A18', fontWeight: '900' }}>20% OFF</Text> your next month if you stay with us today!
                  </Text>
                  <Text style={mgStyles.offerBody}>
                    You'll keep ad-free streaming, HD quality, and exclusive artist content.
                  </Text>
                  <Pressable style={mgStyles.offerBtn} onPress={handleAcceptOffer}>
                    <Text style={mgStyles.offerBtnText}>Claim My 20% Discount</Text>
                  </Pressable>
                </View>

                <Pressable style={[mgStyles.offerBtn, { marginTop: 12, opacity: 0.6 }]} onPress={() => setStep(3)}>
                  <Text style={mgStyles.offerBtnText}>Continue with cancellation</Text>
                </Pressable>
              </View>
            )}

            {step === 3 && (
              <View style={mgStyles.stepContainer}>
                <View style={mgStyles.warningBox}>
                  <AlertTriangle color="#EF4444" size={32} style={{ marginBottom: 12 }} />
                  <Text style={mgStyles.warningTitle}>Are you sure?</Text>
                  <Text style={mgStyles.warningContent}>
                    Your premium benefits will stop at the end of the billing cycle. You will lose HD streaming and ad-free listening.
                  </Text>
                </View>

                <Pressable style={mgStyles.confirmBtn} onPress={handleConfirmCancel}>
                  <Text style={mgStyles.confirmBtnText}>Confirm Cancellation</Text>
                </Pressable>
                
                <Pressable style={[mgStyles.manageBtn, { marginTop: 12, height: 52 }]} onPress={onClose}>
                  <Text style={mgStyles.manageBtnText}>Actually, I'll stay</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────
// SmartUpsell — inline upsell nudge on any screen
// ─────────────────────────────────────────────────────
type SmartUpsellProps = {
  featureText: string; // e.g. "HD Streaming"
  planType: 'ARTIST' | 'PLATFORM';
  onUpgrade: () => void;
};

export function SmartUpsell({ featureText, planType, onUpgrade }: SmartUpsellProps) {
  return (
    <Pressable style={upsellStyles.container} onPress={onUpgrade}>
      <Lock color="#FF7A18" size={16} />
      <Text style={upsellStyles.text}>
        Unlock <Text style={upsellStyles.highlight}>{featureText}</Text> with{' '}
        {planType === 'PLATFORM' ? 'Platform Plan' : 'Artist Subscription'}
      </Text>
      <Text style={upsellStyles.cta}>Upgrade →</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────
// RetentionBanner — shown for expiring subscriptions
// ─────────────────────────────────────────────────────
type RetentionBannerProps = {
  daysLeft: number;
  onRenew: () => void;
};

export function RetentionBanner({ daysLeft, onRenew }: RetentionBannerProps) {
  return (
    <LinearGradient
      colors={['#FFF5F5', '#FFF0F0']}
      style={bannerStyles.container}
    >
      <AlertTriangle color="#EF4444" size={20} />
      <View style={bannerStyles.textWrap}>
        <Text style={bannerStyles.title}>Subscription expiring soon</Text>
        <Text style={bannerStyles.sub}>
          Your access ends in {daysLeft} day{daysLeft === 1 ? '' : 's'}. Renew now to avoid interruption.
        </Text>
      </View>
      <Pressable style={bannerStyles.btn} onPress={onRenew}>
        <Text style={bannerStyles.btnText}>Renew</Text>
      </Pressable>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────
// StrongUpsellModal — shown for persistent unlocked clicks
// ─────────────────────────────────────────────────────
export function StrongUpsellModal({ 
  artistName, 
  onSubscribe 
}: { 
  artistName: string; 
  onSubscribe: () => void; 
}) {
  return (
    <View style={strongUpsellStyles.backdrop}>
      <View style={strongUpsellStyles.card}>
        <Crown color="#FFD700" size={32} />
        <Text style={strongUpsellStyles.title}>Special Access for You!</Text>
        <Text style={strongUpsellStyles.body}>
          We noticed you're interested in {artistName}'s premium content.
          Subscribe now to unlock exclusive tracks, full HD videos, and early access!
        </Text>
        <View style={strongUpsellStyles.benefits}>
          <Text style={strongUpsellStyles.benefitItem}>✅ Full HD Streaming</Text>
          <Text style={strongUpsellStyles.benefitItem}>✅ Exclusive Behind-the-Scenes</Text>
          <Text style={strongUpsellStyles.benefitItem}>✅ Direct Artist Support</Text>
        </View>
        <Pressable style={strongUpsellStyles.btn} onPress={onSubscribe}>
          <Text style={strongUpsellStyles.btnText}>Unlock Everything</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────

const lockedStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  card: {
    width: '88%',
    backgroundColor: 'rgba(15,15,15,0.95)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 24,
    alignItems: 'center',
  },
  iconRow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,122,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heading: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: { width: '100%', borderRadius: 14, overflow: 'hidden', height: 52 },
  btnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

const qualityStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,163,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(74,163,255,0.25)',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  textWrap: { flex: 1, marginLeft: 10 },
  title: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  btn: {
    backgroundColor: '#4AA3FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 8,
  },
  btnText: { color: '#fff', fontSize: 11, fontWeight: '900' },
});

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,122,24,0.12)',
  },
  platformIconWrap: {
    backgroundColor: 'rgba(74,163,255,0.12)',
  },
  planTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  planType: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '800' },

  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  expiryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  expiryValue: { color: '#fff', fontSize: 13, fontWeight: '800' },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  warningText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', marginLeft: 8, flex: 1 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  renewBtn: { flex: 1, height: 44, borderRadius: 12, overflow: 'hidden' },
  renewBtnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  renewBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  manageBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  manageBtnText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '800' },
  
  // New Styles
  detailsGrid: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 16 },
  detailItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  detailLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { color: '#fff', fontSize: 13, fontWeight: '800' },
  benefitsList: { marginBottom: 20, gap: 8 },
  benefitListItem: { flexDirection: 'row', alignItems: 'center' },
  benefitTick: { color: '#4AA3FF', fontSize: 14, fontWeight: '900', marginRight: 10, width: 16 },
  benefitListText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '600' },

  artistItem: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', 
    borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' 
  },
  artistAvatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,122,24,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,122,24,0.2)' },
  artistName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  artistSubInfo: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  artistExpiry: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)' },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  emptySub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  exploreBtn: { width: 200, height: 52, borderRadius: 26, overflow: 'hidden' },
  exploreBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  exploreBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  txDateBlock: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 6 },
  txDay: { color: '#fff', fontSize: 14, fontWeight: '900' },
  txMonth: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  txTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  txId: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  txAmount: { color: '#fff', fontSize: 15, fontWeight: '900' },
  txInvoice: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6 },
  txInvoiceText: { color: '#4AA3FF', fontSize: 11, fontWeight: '800' },
  txStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  txStatusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  txStatusText: { fontSize: 11, fontWeight: '800' },
  txFailedText: { fontSize: 11, fontWeight: '700', marginTop: 4 },
});

const upsellStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,122,24,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.20)',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  text: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  highlight: { color: '#FF7A18', fontWeight: '800' },
  cta: { color: '#FF7A18', fontSize: 12, fontWeight: '900', marginLeft: 8 },
});

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  textWrap: { flex: 1, marginLeft: 12 },
  title: { color: '#1F2937', fontSize: 14, fontWeight: '800' },
  sub: { color: '#4B5563', fontSize: 12, fontWeight: '500', marginTop: 2 },
  btn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

const strongUpsellStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: '90%',
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  body: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  benefits: { alignSelf: 'stretch', marginTop: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 },
  benefitItem: { color: '#fff', fontSize: 14, fontWeight: '700', marginVertical: 4 },
  btn: { width: '100%', height: 56, backgroundColor: '#FF7A18', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});

const mgStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  toggleTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  toggleSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 18 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  stepContainer: { alignItems: 'center' },
  stepHeading: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  stepSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 24 },

  reasonBtn: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, marginBottom: 10 },
  reasonIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,122,24,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  reasonLabel: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },

  offerCard: { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', overflow: 'hidden', backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: 'rgba(255,122,24,0.3)' },
  offerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  offerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  offerBody: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  offerBtn: { backgroundColor: '#FF7A18', borderRadius: 14, width: '100%', height: 52, alignItems: 'center', justifyContent: 'center' },
  offerBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  linkBtn: { marginTop: 20, padding: 10 },
  linkBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },

  warningBox: { width: '100%', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  warningTitle: { color: '#EF4444', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  warningContent: { color: 'rgba(239,68,68,0.7)', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  confirmBtn: { width: '100%', height: 52, backgroundColor: '#EF4444', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  manageBtn: { width: '100%', height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  manageBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
