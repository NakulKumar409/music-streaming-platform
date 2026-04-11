import { useEffect, useMemo, useState } from "react";
import { http } from "../services/http";
import ErrorBoundary from "../components/ErrorBoundary";

// Skeleton component for loading state
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/10 rounded ${className}`} />
  );
}

// Pricing Page Skeleton Loader
function PricingPageSkeleton() {
  return (
    <div className="w-full min-h-screen">
      <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-5xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-48 rounded-full" />
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Monthly Plan Card */}
            <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <Skeleton className="h-9 w-9 rounded-[10px]" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-13 w-11 rounded-[10px]" />
                <Skeleton className="h-13 flex-1 rounded-[10px]" />
              </div>
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-12 w-full" />
            </div>

            {/* Yearly Plan Card */}
            <div className="rounded-[12px] border border-[#c97a54]/20 bg-[#0e0a0a]/35 p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-[#c97a54]/15">
                <Skeleton className="h-9 w-9 rounded-[10px]" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-24 w-full rounded-[10px]" />
              <Skeleton className="h-3 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-13 w-11 rounded-[10px]" />
                <Skeleton className="h-13 flex-1 rounded-[10px]" />
              </div>
            </div>

            {/* Early Access Skeleton */}
            <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-3 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-[8px]" />
                <Skeleton className="h-10 flex-1 rounded-[8px]" />
                <Skeleton className="h-10 flex-1 rounded-[8px]" />
              </div>
            </div>

            {/* Save Button */}
            <Skeleton className="h-14 w-48 rounded-[10px]" />
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Earnings Preview */}
            <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 p-5 space-y-4">
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

            {/* Pricing Tips */}
            <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 p-5 space-y-3">
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
  "Free + subscription hybrid unlocks the widest audience."
];

function EarningsRow({ label, count, price }: { label: string; count: number; price: number }) {
  const monthly = count * price;
  const yearly = monthly * 12;
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/6 last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-[28px] w-[28px] rounded-full bg-[#6a352c]/30 border border-[#7a3f31]/30 flex items-center justify-center text-[11px] font-medium text-[#c97a54]">
          {count}
        </div>
        <div className="text-[13px] text-[#b8a6a1]">{label}</div>
      </div>
      <div className="text-right">
        <div className="text-[14px] font-medium text-[#e6d6d2]">₹{monthly.toLocaleString()}<span className="text-[11px] text-[#8d7b77] font-normal">/mo</span></div>
        <div className="text-[11px] text-[#8d7b77]">₹{yearly.toLocaleString()}/yr</div>
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
  const [contentAccess, setContentAccess] = useState<"free" | "subscription">("free");
  const [subscriptionFeatures, setSubscriptionFeatures] = useState<string[]>([]);
  const [activeTip, setActiveTip] = useState(0);

  const backgroundStyle = useMemo(() => ({
    backgroundImage:
      "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.12) 0%, rgba(25,18,18,0.55) 45%, rgba(10,8,8,0.92) 100%)"
  } as const), []);

  const monthlyNum = useMemo(() => {
    const v = parseFloat(monthlyPrice);
    return isNaN(v) || v < 0 ? 0 : v;
  }, [monthlyPrice]);

  // Yearly price auto-computed from monthly × 12 × (1 - discount%)
  const yearlyNum = useMemo(() => {
    if (!monthlyNum || discountPercent < 0 || discountPercent >= 100) return monthlyNum * 12;
    return parseFloat((monthlyNum * 12 * (1 - discountPercent / 100)).toFixed(2));
  }, [monthlyNum, discountPercent]);

  // Rotate tips every 5s
  useEffect(() => {
    const t = setInterval(() => setActiveTip((p) => (p + 1) % PRICING_TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    try {
      const res = await http.get<PricingResponse>("/api/v1/artist/pricing");
      const p = Number(res.data?.subscriptionPrice ?? 9.99);
      const y = Number(res.data?.yearlySubscriptionPrice ?? 0);
      setMonthlyPrice(p.toFixed(2));
      // Derive discount from saved prices if available
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

  // Parallel data loading for faster response
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    
    (async () => {
      try {
        setLoading(true);
        // Set default values immediately for faster perceived load
        setMonthlyPrice("9.99");
        setDiscountPercent(20);
        setEarlyAccessDays(7);
        
        // Fetch data in parallel with timeout
        const fetchWithTimeout = () => {
          return Promise.race([
            http.get<PricingResponse>("/api/v1/artist/pricing", { signal: controller.signal }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Request timeout")), 5000)
            )
          ]);
        };
        
        const res = await fetchWithTimeout() as any;
        
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
        // Silently use defaults on error - don't block UI
        console.log("Pricing load error:", e?.message);
      } finally {
        if (mounted) {
          // Small delay for smooth skeleton transition
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
        subscriptionFeatures
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to save pricing");
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
        <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-5xl mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-light tracking-wide text-white">Monetize Your Content</h1>
              <p className="mt-1 text-[14px] text-[#b8a6a1]">Set how fans access your music and maximize your earnings.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-[#c97a54]/20 bg-[#6a352c]/10">
              <span className="text-[#c97a54] text-[18px]">💡</span>
              <span className="text-[12px] text-[#b8a6a1] max-w-[200px] leading-snug transition-all duration-500">{PRICING_TIPS[activeTip]}</span>
            </div>
          </div>

          {/* ── Error / Validation ── */}
          {(error || validationError) && (
            <div className="p-4 rounded-[8px] bg-red-950/40 border border-red-900/50 text-[13px] text-[#fca5a5] flex items-center gap-2 animate-shake">
              <span>⚠️</span> {validationError || error}
            </div>
          )}

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column — Pricing plans */}
            <div className="lg:col-span-2 space-y-4">

              <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-[36px] w-[36px] rounded-[10px] bg-gradient-to-br from-[#4a2a27] to-[#1e100a] border border-white/10 flex items-center justify-center text-[16px]">📅</div>
                    <div>
                      <div className="text-[15px] font-medium text-[#e6d6d2]">Monthly Plan</div>
                      <div className="text-[12px] text-[#8d7b77]">Cancel anytime, billed monthly</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#141010]/60 border border-white/10 text-[11px] text-[#b8a6a1]">Recommended</div>
                </div>
                <div className="px-6 py-5">
                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77] mb-3">Price per month</div>
                  <div className="flex items-center gap-2">
                    <div className="h-[52px] w-[44px] shrink-0 rounded-[10px] border border-white/10 bg-[#141010]/60 flex items-center justify-center text-[20px] font-light text-[#c97a54]">₹</div>
                    <input
                      value={monthlyPrice}
                      onChange={(e) => { setMonthlyPrice(e.target.value); setValidationError(null); }}
                      className="w-full h-[52px] rounded-[10px] border border-white/10 bg-[#141010]/55 px-4 text-[22px] font-light text-[#e6d6d2] outline-none focus:border-[#7a3f31]/60 transition-colors"
                      inputMode="decimal"
                      placeholder="9.99"
                    />
                  </div>
                  <div className="mt-2 text-[12px] text-[#8d7b77]">
                    per month &nbsp;·&nbsp; {monthlyNum > 0 ? `₹${(monthlyNum * 12).toFixed(2)} billed yearly equivalent` : "Enter a price above"}
                  </div>
                  <p className="mt-3 text-[12px] text-[#b8a6a1] leading-relaxed">
                    Fans can subscribe and cancel at any time. Best for attracting new listeners.
                  </p>
                </div>
              </div>

              {/* Yearly Plan Card */}
              <div className="rounded-[12px] border border-[#c97a54]/20 bg-[#0e0a0a]/35 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#c97a54]/15 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-[36px] w-[36px] rounded-[10px] bg-gradient-to-br from-[#6a352c] to-[#3d1e18] border border-[#7a3f31]/30 flex items-center justify-center text-[16px]">⭐</div>
                    <div>
                      <div className="text-[15px] font-medium text-[#e6d6d2]">Yearly Plan</div>
                      <div className="text-[12px] text-[#8d7b77]">Best value · Billed once annually</div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full border text-[11px] font-medium transition-all ${
                    discountPercent > 0
                      ? "bg-[#6a352c]/40 border-[#c97a54]/30 text-[#c97a54]"
                      : "bg-[#141010]/40 border-white/10 text-[#8d7b77]"
                  }`}>
                    {discountPercent > 0 ? `Save ${discountPercent}%` : "No discount"}
                  </div>
                </div>
                <div className="px-6 py-5">
                  {/* Discount Control — artist sets this directly */}
                  <div className="mb-5 rounded-[10px] border border-[#c97a54]/15 bg-[#6a352c]/10 px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Yearly Discount</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={70}
                          value={discountPercent}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(70, Number(e.target.value)));
                            setDiscountPercent(v);
                            setValidationError(null);
                          }}
                          className="w-[64px] h-[34px] rounded-[6px] border border-[#c97a54]/30 bg-[#141010]/60 px-2 text-[16px] font-medium text-[#c97a54] outline-none focus:border-[#c97a54]/60 text-center"
                        />
                        <span className="text-[16px] font-medium text-[#c97a54]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={70}
                      step={1}
                      value={discountPercent}
                      onChange={(e) => { setDiscountPercent(Number(e.target.value)); setValidationError(null); }}
                      className="w-full h-[4px] rounded-full accent-[#c97a54] cursor-pointer"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-[#8d7b77]">
                      <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%</span><span>50%</span><span>70%</span>
                    </div>
                  </div>

                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77] mb-3">Computed yearly price</div>
                  <div className="flex items-center gap-2">
                    <div className="h-[52px] w-[44px] shrink-0 rounded-[10px] border border-[#7a3f31]/30 bg-[#6a352c]/20 flex items-center justify-center text-[20px] font-light text-[#c97a54]">$</div>
                    <div className="w-full h-[52px] rounded-[10px] border border-[#7a3f31]/30 bg-[#141010]/40 px-4 flex items-center text-[22px] font-light text-[#e6d6d2]">
                      {yearlyNum.toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 text-[12px] text-[#8d7b77]">
                    per year &nbsp;·&nbsp; {yearlyNum > 0 ? `$${(yearlyNum / 12).toFixed(2)}/month equivalent` : "Set monthly price first"}
                  </div>
                  <p className="mt-3 text-[12px] text-[#c97a54]/80 leading-relaxed">
                    {discountPercent > 0
                      ? `Fans save ${discountPercent}% vs monthly — fans who commit yearly stay 3× longer.`
                      : "Fans pay full yearly price with no discount. Add a discount to boost conversions."}
                  </p>
                </div>
              </div>

              {/* Early Access */}
              <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[16px]">⏰</span>
                  <div className="text-[14px] font-medium text-[#e6d6d2]">Early Access</div>
                </div>
                <div className="text-[12px] text-[#8d7b77] mb-4">How many days before public release subscribers get access.</div>
                <div className="flex gap-2">
                  {EARLY_ACCESS_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setEarlyAccessDays(days)}
                      className={`flex-1 h-[42px] rounded-[8px] border text-[13px] font-medium transition-all ${
                        earlyAccessDays === days
                          ? "border-[#c97a54]/50 bg-[#6a352c]/35 text-[#c97a54]"
                          : "border-white/10 bg-[#141010]/40 text-[#8d7b77] hover:text-[#e6d6d2] hover:bg-white/5"
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-[#8d7b77]">
                  Subscribers get content <span className="text-[#e6d6d2]">{earlyAccessDays} days</span> before everyone else.
                </p>
              </div>

              {/* Custom Features */}
              <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">✨</span>
                    <div className="text-[14px] font-medium text-[#e6d6d2]">Custom Features</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (subscriptionFeatures.length < 8) {
                        setSubscriptionFeatures([...subscriptionFeatures, ""]);
                      }
                    }}
                    disabled={subscriptionFeatures.length >= 8}
                    className="text-[12px] font-medium text-[#c97a54] hover:text-[#e6d6d2] transition-colors disabled:opacity-50"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="text-[12px] text-[#8d7b77] mb-4">Highlight the exclusive benefits fans get by subscribing to your plan.</div>
                
                <div className="space-y-3">
                  {subscriptionFeatures.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#141010]/40 rounded-[8px] p-2 border border-white/5">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => {
                          const newFeatures = [...subscriptionFeatures];
                          newFeatures[i] = e.target.value.substring(0, 100);
                          setSubscriptionFeatures(newFeatures);
                        }}
                        className="flex-1 bg-transparent border-none text-[13px] text-[#e6d6d2] outline-none placeholder-[#8d7b77]"
                        placeholder="e.g. Exclusive Behind The Scenes"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newFeatures = subscriptionFeatures.filter((_, idx) => idx !== i);
                          setSubscriptionFeatures(newFeatures);
                        }}
                        className="text-[14px] text-[#8d7b77] hover:text-[#fca5a5] p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {subscriptionFeatures.length === 0 && (
                    <div className="text-[12px] text-[#8d7b77] italic py-2 text-center border border-dashed border-white/10 rounded-[8px]">
                      No custom features added yet.
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
                  className="h-[52px] px-10 rounded-[10px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[15px] font-medium tracking-wide text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)] hover:shadow-[0_15px_30px_rgba(106,53,44,0.4)] disabled:opacity-60 transition-all hover:-translate-y-0.5"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save & Apply Pricing 🚀"
                  )}
                </button>
                {saved && (
                  <div className="flex items-center gap-2 text-[13px] text-[#6e8f72] animate-pulse">
                    <span>✓</span> Pricing saved successfully!
                  </div>
                )}
              </div>
            </div>

            {/* Right column — Earnings preview + Tips */}
            <div className="space-y-4">

              {/* Earnings Preview */}
              <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <div className="text-[14px] font-medium text-[#e6d6d2]">📈 Earnings Preview</div>
                  <div className="text-[12px] text-[#8d7b77] mt-0.5">Based on your monthly price</div>
                </div>
                <div className="px-5 py-4">
                  {monthlyNum > 0 ? (
                    <>
                      <EarningsRow label="10 subscribers" count={10} price={monthlyNum} />
                      <EarningsRow label="50 subscribers" count={50} price={monthlyNum} />
                      <EarningsRow label="100 subscribers" count={100} price={monthlyNum} />
                      <EarningsRow label="500 subscribers" count={500} price={monthlyNum} />
                    </>
                  ) : (
                    <div className="py-4 text-center text-[13px] text-[#8d7b77]">
                      Enter a price to see your earnings estimate.
                    </div>
                  )}
                </div>
                {yearlyNum > 0 && monthlyNum > 0 && (
                  <div className="px-5 py-3 border-t border-white/6 bg-[#6a352c]/10">
                    <div className="text-[11px] text-[#c97a54]">
                      💡 With yearly plan at ${yearlyNum}/yr, 100 yearly subs = ${(100 * yearlyNum).toLocaleString()}/yr
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Tips */}
              <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
                <div className="text-[13px] font-medium text-[#e6d6d2] mb-3">💡 Pricing Tips</div>
                <ul className="space-y-3">
                  {PRICING_TIPS.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-[#8d7b77] leading-relaxed">
                      <span className="text-[#c97a54]/60 mt-0.5 shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Current Config Summary */}
              <div className="rounded-[12px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
                <div className="text-[13px] font-medium text-[#e6d6d2] mb-3">⚙️ Current Config</div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#8d7b77]">Monthly</span>
                    <span className="text-[#e6d6d2]">${monthlyNum.toFixed(2)}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8d7b77]">Yearly</span>
                    <span className="text-[#e6d6d2]">${yearlyNum.toFixed(2)}/yr</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#8d7b77]">Discount</span>
                      <span className="text-[#c97a54]">{discountPercent}% off</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#8d7b77]">Early Access</span>
                    <span className="text-[#e6d6d2]">{earlyAccessDays} days</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#8d7b77]">Features</span>
                    <span className="text-[#e6d6d2]">{subscriptionFeatures.length} added</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
