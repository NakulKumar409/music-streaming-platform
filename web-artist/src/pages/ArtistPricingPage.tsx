// src/pages/ArtistPricingPage.tsx
import { useEffect, useMemo, useState } from "react";
import { http } from "../services/http";
import ErrorBoundary from "../components/ErrorBoundary";
import {
  Calendar,
  Crown,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Loader2,
  TrendingUp,
  Zap,
  Gift,
  Plus,
  X,
  Settings,
  BarChart3,
  Wallet,
  Users,
  Percent,
  Shield,
  Rocket,
  Star,
} from "lucide-react";

// Skeleton component for loading state
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

// Pricing Page Skeleton Loader
function PricingPageSkeleton() {
  return (
    <div className="w-full min-h-screen">
      <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-48 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-13 w-11 rounded-xl" />
                <Skeleton className="h-13 flex-1 rounded-xl" />
              </div>
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="rounded-2xl border border-primary/20 bg-surface p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-primary/15">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-3 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-13 w-11 rounded-xl" />
                <Skeleton className="h-13 flex-1 rounded-xl" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-3 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-xl" />
                <Skeleton className="h-10 flex-1 rounded-xl" />
                <Skeleton className="h-10 flex-1 rounded-xl" />
              </div>
            </div>
            <Skeleton className="h-14 w-48 rounded-xl" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-4">
              <div className="pb-4 border-b border-white/10">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48 mt-1" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-3">
              <Skeleton className="h-4 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type PricingResponse = {
  success: boolean;
  subscriptionPrice?: number;
  yearlySubscriptionPrice?: number;
  earlyAccessDays?: number;
  contentAccess?: "free" | "subscription";
  subscriptionFeatures?: string[];
};

const EARLY_ACCESS_OPTIONS = [7, 14, 30];

const PRICING_TIPS = [
  "Artists charging ₹4–₹8/month see the highest subscriber conversions.",
  "Yearly plans with ~20% discount retain fans 3x longer.",
  "Early access is your biggest hook — fans love being first.",
  "Free + subscription hybrid unlocks the widest audience.",
];

function EarningsRow({
  label,
  count,
  price,
}: {
  label: string;
  count: number;
  price: number;
}) {
  const monthly = count * price;
  const yearly = monthly * 12;
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group hover:bg-white/5 px-3 rounded-xl transition-all">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary group-hover:scale-110 transition-transform">
          {count}
        </div>
        <div className="text-sm text-[#B8A6A1] group-hover:text-white transition-colors">
          {label}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-white">
          ₹{monthly.toLocaleString()}
          <span className="text-xs text-[#8D7B77] font-normal">/mo</span>
        </div>
        <div className="text-xs text-[#8D7B77]">
          ₹{yearly.toLocaleString()}/yr
        </div>
      </div>
    </div>
  );
}

export default function ArtistPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [monthlyPrice, setMonthlyPrice] = useState<string>("9.99");
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [earlyAccessDays, setEarlyAccessDays] = useState<number>(7);
  const [contentAccess, setContentAccess] = useState<"free" | "subscription">(
    "free"
  );
  const [subscriptionFeatures, setSubscriptionFeatures] = useState<string[]>(
    []
  );
  const [activeTip, setActiveTip] = useState(0);

  const backgroundStyle = useMemo(
    () =>
      ({
        backgroundImage:
          "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.05) 0%, rgba(10,10,10,0.98) 100%)",
      } as const),
    []
  );

  const monthlyNum = useMemo(() => {
    const v = parseFloat(monthlyPrice);
    return isNaN(v) || v < 0 ? 0 : v;
  }, [monthlyPrice]);

  const yearlyNum = useMemo(() => {
    if (!monthlyNum || discountPercent < 0 || discountPercent >= 100)
      return monthlyNum * 12;
    return parseFloat(
      (monthlyNum * 12 * (1 - discountPercent / 100)).toFixed(2)
    );
  }, [monthlyNum, discountPercent]);

  useEffect(() => {
    const t = setInterval(
      () => setActiveTip((p) => (p + 1) % PRICING_TIPS.length),
      5000
    );
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    try {
      const res = await http.get<PricingResponse>("/api/v1/artist/pricing");
      const p = Number(res.data?.subscriptionPrice ?? 9.99);
      const y = Number(res.data?.yearlySubscriptionPrice ?? 0);
      setMonthlyPrice(p.toFixed(2));
      if (y > 0 && p > 0) {
        const savedDiscount = Math.round(((p * 12 - y) / (p * 12)) * 100);
        setDiscountPercent(Math.max(0, Math.min(70, savedDiscount)));
      }
      setEarlyAccessDays(Number(res.data?.earlyAccessDays ?? 7));
      setContentAccess((res.data?.contentAccess as any) ?? "free");
      setSubscriptionFeatures(res.data?.subscriptionFeatures ?? []);
    } catch {
      // Use defaults on first load
    }
  };

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setMonthlyPrice("9.99");
        setDiscountPercent(20);
        setEarlyAccessDays(7);

        const fetchWithTimeout = () => {
          return Promise.race([
            http.get<PricingResponse>("/api/v1/artist/pricing", {
              signal: controller.signal,
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Request timeout")), 5000)
            ),
          ]);
        };

        const res = (await fetchWithTimeout()) as any;

        if (!mounted) return;

        const p = Number(res.data?.subscriptionPrice ?? 9.99);
        const y = Number(res.data?.yearlySubscriptionPrice ?? 0);
        setMonthlyPrice(p.toFixed(2));
        if (y > 0 && p > 0) {
          const savedDiscount = Math.round(((p * 12 - y) / (p * 12)) * 100);
          setDiscountPercent(Math.max(0, Math.min(70, savedDiscount)));
        }
        setEarlyAccessDays(Number(res.data?.earlyAccessDays ?? 7));
        setContentAccess((res.data?.contentAccess as any) ?? "free");
        setSubscriptionFeatures(res.data?.subscriptionFeatures ?? []);
      } catch (e: any) {
        console.log("Pricing load error:", e?.message);
      } finally {
        if (mounted) {
          setTimeout(() => setLoading(false), 200);
        }
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const validate = () => {
    if (monthlyNum <= 0) {
      setValidationError("Monthly price must be greater than ₹0.00");
      return false;
    }
    if (discountPercent < 0 || discountPercent > 70) {
      setValidationError("Yearly discount must be between 0% and 70%.");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await http.patch("/api/v1/artist/pricing", {
        subscriptionPrice: monthlyNum,
        yearlySubscriptionPrice: yearlyNum,
        discountPercent,
        earlyAccessDays,
        contentAccess,
        subscriptionFeatures,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to save pricing"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ErrorBoundary label="Artist: Pricing">
        <PricingPageSkeleton />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary label="Artist: Pricing">
      <div className="w-full animate-fadeIn" style={backgroundStyle}>
        <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Monetize Your Content
                  </h1>
                  <p className="text-sm text-[#B8A6A1]">
                    Set how fans access your music and maximize your earnings.
                  </p>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/10 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs text-[#B8A6A1] max-w-[200px] leading-snug transition-all duration-500">
                {PRICING_TIPS[activeTip]}
              </span>
            </div>
          </div>

          {/* Error / Validation */}
          {(error || validationError) && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {validationError || error}
            </div>
          )}

          {/* Main Grid - Expanded Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left column — Pricing plans (3/5 width) */}
            <div className="lg:col-span-3 space-y-5">
              {/* Monthly Plan */}
              <div className="rounded-2xl border border-white/10 bg-surface overflow-hidden hover:border-primary/20 transition-all hover:shadow-lg hover:shadow-primary/5">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Monthly Plan
                      </div>
                      <div className="text-xs text-[#8D7B77]">
                        Cancel anytime, billed monthly
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-xs text-primary font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" /> Recommended
                  </div>
                </div>
                <div className="px-6 py-5">
                  <div className="text-xs uppercase tracking-wider text-[#B8A6A1] font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Price per month
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-[56px] w-[48px] shrink-0 rounded-xl border border-white/10 bg-background/60 flex items-center justify-center text-2xl font-bold text-primary">
                      ₹
                    </div>
                    <input
                      value={monthlyPrice}
                      onChange={(e) => {
                        setMonthlyPrice(e.target.value);
                        setValidationError(null);
                      }}
                      className="w-full h-[56px] rounded-xl border border-white/10 bg-background/60 px-4 text-2xl font-bold text-white outline-none focus:border-primary/50 focus:shadow-[0_0_30px_rgba(232,93,44,0.1)] transition-all"
                      inputMode="decimal"
                      placeholder="9.99"
                    />
                  </div>
                  <div className="mt-2 text-xs text-[#8D7B77] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    per month &nbsp;·&nbsp;{" "}
                    {monthlyNum > 0
                      ? `₹${(monthlyNum * 12).toFixed(
                          2
                        )} billed yearly equivalent`
                      : "Enter a price above"}
                  </div>
                  <p className="mt-3 text-sm text-[#B8A6A1] leading-relaxed">
                    Fans can subscribe and cancel at any time. Best for
                    attracting new listeners.
                  </p>
                </div>
              </div>

              {/* Yearly Plan */}
              <div className="rounded-2xl border border-primary/20 bg-surface overflow-hidden hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/10">
                <div className="px-6 py-4 border-b border-primary/15 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/25">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Yearly Plan
                      </div>
                      <div className="text-xs text-[#8D7B77]">
                        Best value · Billed once annually
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-all flex items-center gap-1 ${
                      discountPercent > 0
                        ? "bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30 text-primary"
                        : "bg-background/40 border-white/10 text-[#8D7B77]"
                    }`}>
                    {discountPercent > 0 ? <Gift className="w-3 h-3" /> : null}
                    {discountPercent > 0
                      ? `Save ${discountPercent}%`
                      : "No discount"}
                  </div>
                </div>
                <div className="px-6 py-5">
                  {/* Discount Control */}
                  <div className="mb-5 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-wider text-[#B8A6A1] font-medium flex items-center gap-2">
                        <Percent className="w-4 h-4 text-primary" />
                        Yearly Discount
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={70}
                          value={discountPercent}
                          onChange={(e) => {
                            const v = Math.max(
                              0,
                              Math.min(70, Number(e.target.value))
                            );
                            setDiscountPercent(v);
                            setValidationError(null);
                          }}
                          className="w-[70px] h-[36px] rounded-lg border border-primary/30 bg-background/60 px-2 text-base font-bold text-primary outline-none focus:border-primary/60 text-center"
                        />
                        <span className="text-base font-bold text-primary">
                          %
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={70}
                      step={1}
                      value={discountPercent}
                      onChange={(e) => {
                        setDiscountPercent(Number(e.target.value));
                        setValidationError(null);
                      }}
                      className="w-full h-1.5 rounded-full accent-primary cursor-pointer bg-white/10"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-[#8D7B77]">
                      <span>0%</span>
                      <span>10%</span>
                      <span>20%</span>
                      <span>30%</span>
                      <span>40%</span>
                      <span>50%</span>
                      <span>70%</span>
                    </div>
                  </div>

                  <div className="text-xs uppercase tracking-wider text-[#B8A6A1] font-medium mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Computed yearly price
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-[56px] w-[48px] shrink-0 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-2xl font-bold text-primary">
                      ₹
                    </div>
                    <div className="w-full h-[56px] rounded-xl border border-primary/30 bg-background/60 px-4 flex items-center text-2xl font-bold text-white">
                      {yearlyNum.toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#8D7B77] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    per year &nbsp;·&nbsp;{" "}
                    {yearlyNum > 0
                      ? `₹${(yearlyNum / 12).toFixed(2)}/month equivalent`
                      : "Set monthly price first"}
                  </div>
                  <p className="mt-3 text-sm text-primary/80 leading-relaxed">
                    {discountPercent > 0
                      ? `Fans save ${discountPercent}% vs monthly — fans who commit yearly stay 3× longer.`
                      : "Fans pay full yearly price with no discount. Add a discount to boost conversions."}
                  </p>
                </div>
              </div>

              {/* Early Access */}
              <div className="rounded-2xl border border-white/10 bg-surface px-6 py-5 hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Early Access
                  </div>
                </div>
                <div className="text-xs text-[#8D7B77] mb-4 ml-11">
                  How many days before public release subscribers get access.
                </div>
                <div className="flex gap-2 ml-11">
                  {EARLY_ACCESS_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setEarlyAccessDays(days)}
                      className={`flex-1 h-[42px] rounded-xl border text-sm font-medium transition-all ${
                        earlyAccessDays === days
                          ? "border-primary/50 bg-gradient-to-r from-primary/20 to-secondary/20 text-primary shadow-lg shadow-primary/10"
                          : "border-white/10 bg-background/40 text-[#8D7B77] hover:text-white hover:bg-white/5"
                      }`}>
                      {days}d
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#8D7B77] ml-11">
                  Subscribers get content{" "}
                  <span className="text-white font-medium">
                    {earlyAccessDays} days
                  </span>{" "}
                  before everyone else.
                </p>
              </div>

              {/* Custom Features */}
              <div className="rounded-2xl border border-white/10 bg-surface px-6 py-5 hover:border-primary/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Gift className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Custom Features
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (subscriptionFeatures.length < 8) {
                        setSubscriptionFeatures([...subscriptionFeatures, ""]);
                      }
                    }}
                    disabled={subscriptionFeatures.length >= 8}
                    className="text-xs font-medium text-primary hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/30 hover:border-primary/50 hover:bg-primary/10 transition-all">
                    <Plus className="w-4 h-4" /> Add Feature
                  </button>
                </div>
                <div className="text-xs text-[#8D7B77] mb-4 ml-11">
                  Highlight the exclusive benefits fans get by subscribing to
                  your plan.
                </div>

                <div className="space-y-3 ml-11">
                  {subscriptionFeatures.map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-background/40 rounded-xl p-2 border border-white/5 hover:border-primary/20 transition-all group">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => {
                          const newFeatures = [...subscriptionFeatures];
                          newFeatures[i] = e.target.value.substring(0, 100);
                          setSubscriptionFeatures(newFeatures);
                        }}
                        className="flex-1 bg-transparent border-none text-sm text-white outline-none placeholder-[#8D7B77]"
                        placeholder="e.g. Exclusive Behind The Scenes"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newFeatures = subscriptionFeatures.filter(
                            (_, idx) => idx !== i
                          );
                          setSubscriptionFeatures(newFeatures);
                        }}
                        className="text-[#8D7B77] hover:text-rose-400 p-1 transition-colors opacity-0 group-hover:opacity-100">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {subscriptionFeatures.length === 0 && (
                    <div className="text-xs text-[#8D7B77] italic py-3 text-center border border-dashed border-white/10 rounded-xl">
                      No custom features added yet. Click "Add Feature" to get
                      started.
                    </div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={save}
                  className="h-[56px] px-10 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Save & Apply Pricing
                    </>
                  )}
                </button>
                {saved && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400 animate-pulse">
                    <CheckCircle className="w-4 h-4" /> Pricing saved
                    successfully!
                  </div>
                )}
              </div>
            </div>

            {/* Right column — Earnings preview + Tips (2/5 width) */}
            <div className="lg:col-span-2 space-y-5">
              {/* Earnings Preview */}
              <div className="rounded-2xl border border-white/10 bg-surface overflow-hidden hover:border-primary/20 transition-all">
                <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Earnings Preview
                  </div>
                  <div className="text-xs text-[#8D7B77] mt-0.5">
                    Based on your monthly price
                  </div>
                </div>
                <div className="px-5 py-4">
                  {monthlyNum > 0 ? (
                    <>
                      <EarningsRow
                        label="10 subscribers"
                        count={10}
                        price={monthlyNum}
                      />
                      <EarningsRow
                        label="50 subscribers"
                        count={50}
                        price={monthlyNum}
                      />
                      <EarningsRow
                        label="100 subscribers"
                        count={100}
                        price={monthlyNum}
                      />
                      <EarningsRow
                        label="500 subscribers"
                        count={500}
                        price={monthlyNum}
                      />
                    </>
                  ) : (
                    <div className="py-4 text-center text-sm text-[#8D7B77]">
                      Enter a price to see your earnings estimate.
                    </div>
                  )}
                </div>
                {yearlyNum > 0 && monthlyNum > 0 && (
                  <div className="px-5 py-3 border-t border-white/5 bg-gradient-to-r from-primary/10 to-transparent">
                    <div className="text-xs text-primary flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      With yearly plan at ₹{yearlyNum}/yr, 100 yearly subs = ₹
                      {(100 * yearlyNum).toLocaleString()}/yr
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Tips */}
              <div className="rounded-2xl border border-white/10 bg-surface px-5 py-5 hover:border-primary/20 transition-all">
                <div className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  Pricing Tips
                </div>
                <ul className="space-y-3">
                  {PRICING_TIPS.map((tip, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-xs text-[#8D7B77] leading-relaxed hover:text-[#B8A6A1] transition-colors">
                      <span className="text-primary mt-0.5 shrink-0">✦</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Current Config Summary */}
              <div className="rounded-2xl border border-white/10 bg-surface px-5 py-5 hover:border-primary/20 transition-all">
                <div className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Settings className="w-4 h-4 text-primary" />
                  Current Config
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-[#8D7B77]">Monthly</span>
                    <span className="text-white font-medium">
                      ₹{monthlyNum.toFixed(2)}/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-[#8D7B77]">Yearly</span>
                    <span className="text-white font-medium">
                      ₹{yearlyNum.toFixed(2)}/yr
                    </span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                      <span className="text-[#8D7B77]">Discount</span>
                      <span className="text-primary font-medium">
                        {discountPercent}% off
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-[#8D7B77]">Early Access</span>
                    <span className="text-white font-medium">
                      {earlyAccessDays} days
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[#8D7B77]">Features</span>
                    <span className="text-white font-medium">
                      {subscriptionFeatures.length} added
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-[#8D7B77]">
                  <Shield className="w-3 h-3 text-primary" />
                  All changes are saved automatically
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </ErrorBoundary>
  );
}
