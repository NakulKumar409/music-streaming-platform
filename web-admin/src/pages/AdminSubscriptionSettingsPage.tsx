import {
  AlertCircle,
  Award,
  CheckCircle2,
  Crown,
  DollarSign,
  Gift,
  LayoutDashboard,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageWrapper from "../components/PageWrapper";
import { http } from "../services/http";

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

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await http.get<ConfigResponse>(
        "/api/v1/fan/subscriptions/platform-config"
      );
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
      setApiError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to load configuration"
      );
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
      const res = await http.put(
        "/api/v1/admin/subscriptions/platform-config",
        {
          price: Number(price),
          yearlyPrice: Number(yearlyPrice),
          currency,
          duration,
          features,
        }
      );

      if (res.data?.success) {
        setSuccessMsg("Platform configuration updated successfully");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setApiError(res.data?.message || "Failed to update configuration");
      }
    } catch (e: any) {
      setApiError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to update configuration"
      );
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
      <PageWrapper
        title="Platform Plan"
        subtitle="Configure subscription settings">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="text-sm text-[#8D7B77] mt-4">
            Loading configuration...
          </div>
        </div>
      </PageWrapper>
    );
  }

  const monthlyPrice = Number(price) || 0;
  const yearlyPriceNum = Number(yearlyPrice) || 0;
  const savings =
    yearlyPriceNum > 0
      ? Math.round((1 - yearlyPriceNum / 12 / monthlyPrice) * 100)
      : 0;

  return (
    <PageWrapper
      title="Platform Plan"
      subtitle="Configure the default subscription plan for your users">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">
                  Monthly Price
                </p>
                <p className="mt-1.5 text-3xl font-bold text-white">
                  {currency} {monthlyPrice}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Wallet size={20} className="text-primary" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">
                  Yearly Price
                </p>
                <p className="mt-1.5 text-3xl font-bold text-green-400">
                  {currency} {yearlyPriceNum}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10">
                <Gift size={20} className="text-green-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">Savings</p>
                <p className="mt-1.5 text-3xl font-bold text-blue-400">
                  {savings}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <TrendingUp size={20} className="text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">Features</p>
                <p className="mt-1.5 text-3xl font-bold text-purple-400">
                  {features.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Award size={20} className="text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {apiError && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Error</p>
            <p className="text-sm text-red-300/80">{apiError}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-400">Success</p>
            <p className="text-sm text-emerald-300/80">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Pricing */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/5 bg-surface p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <DollarSign size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Core Pricing
                </h2>
                <p className="text-sm text-[#8D7B77]">
                  Set your subscription prices
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                  Monthly Price ({currency})
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 text-white text-lg font-bold outline-none focus:border-primary/50 transition-all"
                  placeholder="0.00"
                />
                <p className="text-xs text-[#8D7B77] mt-1.5">
                  Auto-renewed every 30 days
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                  Yearly Price ({currency})
                </label>
                <input
                  type="number"
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(e.target.value)}
                  className="w-full h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 text-white text-lg font-bold outline-none focus:border-primary/50 transition-all"
                  placeholder="0.00"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-xs font-medium text-primary">
                    Best Value Option
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                    Billing Cycle
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full h-[48px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-primary/50 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%238D7B77%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_14px_center] bg-no-repeat">
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Features */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-white/5 bg-surface p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10">
                  <Crown size={20} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Plan Benefits
                  </h2>
                  <p className="text-sm text-[#8D7B77]">
                    Features included in the subscription
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {features.length} features
              </span>
            </div>

            <div className="space-y-2 min-h-[200px]">
              {features.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                  <LayoutDashboard size={32} className="text-[#8D7B77] mb-3" />
                  <p className="text-sm text-[#8D7B77]">
                    No features added yet
                  </p>
                  <p className="text-xs text-[#8D7B77]/60 mt-1">
                    Add features below
                  </p>
                </div>
              ) : (
                features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 hover:border-primary/30 hover:bg-white/5 transition-all">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} className="text-primary" />
                    </div>
                    <span className="flex-1 text-sm text-white">{feat}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFeature()}
                    placeholder="Add a feature (e.g. Ad-free experience)"
                    className="w-full h-[44px] rounded-xl bg-black/30 border border-white/10 px-4 pr-14 text-sm text-white placeholder:text-[#8D7B77] outline-none focus:border-primary/50 transition-all"
                  />
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-[#8D7B77] font-medium uppercase tracking-wider">
                    Enter
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addFeature}
                  className="h-[44px] w-[44px] flex items-center justify-center rounded-xl bg-primary text-white hover:bg-secondary transition-all hover:shadow-lg hover:shadow-primary/30">
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex items-center gap-2 h-[48px] px-8 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50">
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Configuration
            </>
          )}
        </button>
      </div>
    </PageWrapper>
  );
}
