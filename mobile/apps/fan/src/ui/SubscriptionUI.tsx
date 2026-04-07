import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Crown, Award, AlertTriangle, RefreshCw } from 'lucide-react-native';
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
    color: 'rgba(255,255,255,0.65)',
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
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', marginTop: 2 },
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
  planType: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  expiryLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
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
  manageBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800' },
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
