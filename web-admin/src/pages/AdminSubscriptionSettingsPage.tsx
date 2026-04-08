import { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { http } from "../services/http";
import { 
  CreditCard, 
  Settings2, 
  Plus, 
  Trash2, 
  Save, 
  ChevronRight, 
  ShieldCheck, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  LayoutDashboard
} from "lucide-react";

type SubscriptionConfig = {
  price: number;
  yearly_price: number;
  currency: string;
  duration: string;
  features: string[];
};

type ConfigResponse = {
  success: boolean;
  config?: SubscriptionConfig;
  message?: string;
};

export default function AdminSubscriptionSettingsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [price, setPrice] = useState<string>("99");
  const [yearlyPrice, setYearlyPrice] = useState<string>("999");
  const [currency, setCurrency] = useState<string>("INR");
  const [duration, setDuration] = useState<string>("monthly");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(108,99,255,0.06) 0%, rgba(75,25,39,0.88) 55%, rgba(10,8,8,0.98) 100%)"
    } as const;
  }, []);

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await http.get<ConfigResponse>("/api/v1/fan/subscriptions/platform-config");
      if (res.data?.success && res.data.config) {
        setPrice(String(res.data.config.price));
        setYearlyPrice(String(res.data.config.yearly_price || ""));
        setCurrency(res.data.config.currency);
        setDuration(res.data.config.duration || "monthly");
        setFeatures(res.data.config.features || []);
      }
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin/login", { replace: true });
        return;
      }
      setApiError(e?.response?.data?.message || e?.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setApiError(null);
    setSuccessMsg(null);
    try {
      const res = await http.put("/api/v1/admin/subscriptions/platform-config", {
        price: Number(price),
        yearlyPrice: Number(yearlyPrice),
        currency,
        duration,
        features
      });

      if (res.data?.success) {
        setSuccessMsg("Platform configuration updated successfully");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setApiError(res.data?.message || "Failed to update configuration");
      }
    } catch (e: any) {
      setApiError(e?.response?.data?.message || e?.message || "Failed to update configuration");
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setFeatures([...features, newFeature.trim()]);
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#0a0808] flex items-center justify-center" style={backgroundStyle}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#b16e5b]/20 border-t-[#b16e5b] rounded-full animate-spin" />
          <div className="text-[13px] text-[#b8a6a1] tracking-widest uppercase">Loading System Config...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0808] text-white selection:bg-[#b16e5b]/30" style={backgroundStyle}>
      {/* ── Page Container ── */}
      <div className="mx-auto w-full max-w-[1100px] px-6 py-12">
        
        {/* ── Breadcrumbs / Minimal Header ── */}
        <div className="flex items-center gap-2 mb-8 text-[12px] font-medium tracking-widest text-[#8d7b77] uppercase">
          <NavLink to="/admin/home" className="hover:text-white transition-colors">Admin</NavLink>
          <ChevronRight size={14} className="opacity-50" />
          <span className="text-[#b16e5b]">Monetization</span>
        </div>

        {/* ── Main Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#b16e5b] to-[#4b1927] flex items-center justify-center shadow-lg shadow-[#b16e5b]/10">
                <ShieldCheck color="#fff" size={24} />
              </div>
              <h1 className="text-[34px] font-light tracking-tight text-[#e6d6d2]">Platform Plan</h1>
            </div>
            <p className="text-[14px] text-[#b8a6a1] max-w-[500px] leading-relaxed">
              Configure the default subscription plan for your users. These settings override internal defaults and update across all platforms in real-time.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="group relative flex items-center gap-2 h-[48px] px-8 rounded-xl bg-gradient-to-b from-[#b16e5b] to-[#7d4a41] border border-white/10 text-[14px] font-semibold tracking-wide text-white shadow-2xl hover:brightness-110 disabled:opacity-50 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            <span>{saving ? "Deploying..." : "Save Configuration"}</span>
          </button>
        </div>

        {/* ── Feedback Messages ── */}
        {apiError && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertCircle className="text-red-400" size={20} />
            <div className="text-[14px] text-red-100/80">{apiError}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="text-emerald-400" size={20} />
            <div className="text-[14px] text-emerald-100/80">{successMsg}</div>
          </div>
        )}

        {/* ── Setup Cards Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── Left Column: Pricing & Setup ── */}
          <div className="lg:col-span-5 space-y-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CreditCard size={80} strokeWidth={1} />
              </div>
              
              <div className="flex items-center gap-3 mb-8">
                <Settings2 className="text-[#b16e5b]" size={18} />
                <h2 className="text-[16px] font-semibold tracking-wide text-[#e6d6d2]">Core Pricing</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black tracking-[2px] text-[#b16e5b] uppercase">Monthly Price (₹)</label>
                  <div className="relative group/input">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full h-[52px] rounded-xl bg-black/60 border border-white/20 px-5 text-[16px] font-bold text-white outline-none focus:border-[#b16e5b] focus:ring-4 focus:ring-[#b16e5b]/10 transition-all placeholder:text-white/30"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-[12px] text-[#b8a6a1] font-medium">Auto-renewed every 30 days.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black tracking-[2px] text-[#b16e5b] uppercase">Yearly Price (₹)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={yearlyPrice}
                      onChange={(e) => setYearlyPrice(e.target.value)}
                      className="w-full h-[52px] rounded-xl bg-black/60 border border-white/20 px-5 text-[16px] font-bold text-white outline-none focus:border-[#b16e5b] focus:ring-4 focus:ring-[#b16e5b]/10 transition-all placeholder:text-white/30"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-[12px] text-white font-black uppercase tracking-[1px] pt-1">Best Value Option</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black tracking-[2px] text-[#b16e5b] uppercase">Currency</label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-[52px] rounded-xl bg-black/60 border border-white/20 px-5 text-[15px] font-bold text-white outline-none focus:border-[#b16e5b] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black tracking-[2px] text-[#b16e5b] uppercase">Default Cycle</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full h-[52px] rounded-xl bg-black/60 border border-white/20 px-4 text-[15px] font-bold text-white outline-none focus:border-[#b16e5b] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23ffffff%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:22px_22px] bg-[right_14px_center] bg-no-repeat"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Features Management ── */}
          <div className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Zap className="text-[#b16e5b]" size={18} />
                  <h2 className="text-[16px] font-semibold tracking-wide text-[#e6d6d2]">Plan Benefits</h2>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black tracking-[1px] text-[#b8a6a1] uppercase">
                  {features.length} Activated
                </div>
              </div>

              <div className="flex-1 space-y-3 min-h-[300px]">
                {features.map((feat, idx) => (
                  <div 
                    key={idx} 
                    className="group flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-[#b16e5b]/30 hover:bg-white/5 transition-all animate-in slide-in-from-right-4 duration-300"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="h-8 w-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-110 transition-transform">
                      <CheckCircle2 size={16} className="text-[#b16e5b] group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 text-[13.5px] font-medium text-white tracking-wide">
                      {feat}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                
                {features.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/10 rounded-2xl">
                    <LayoutDashboard className="text-white/10 mb-4" size={48} />
                    <div className="text-[13px] text-[#b8a6a1]">No features added yet.</div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative group">
                    <input
                      type="text"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                      placeholder="e.g. Ad-free Music Experience"
                      className="w-full h-[52px] rounded-xl bg-black/60 border border-white/20 pl-5 pr-14 text-[14px] text-white outline-none focus:border-[#b16e5b] transition-all placeholder:text-white/50"
                    />
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-[10px] font-bold text-white/40 tracking-widest uppercase">
                      Enter
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addFeature}
                    className="h-[52px] w-[52px] flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-[#b16e5b] transition-all group shadow-xl"
                  >
                    <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>


      </div>
    </div>
  );
}


