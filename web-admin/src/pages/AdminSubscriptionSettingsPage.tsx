import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../services/http";

type SubscriptionConfig = {
  price: number;
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
  const [currency, setCurrency] = useState<string>("INR");
  const [duration, setDuration] = useState<string>("monthly");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(108,99,255,0.08) 0%, rgba(75,25,39,0.88) 55%, rgba(10,8,8,0.97) 100%)"
    } as const;
  }, []);

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await http.get<ConfigResponse>("/api/v1/fan/subscriptions/platform-config");
      if (res.data?.success && res.data.config) {
        setPrice(String(res.data.config.price));
        setCurrency(res.data.config.currency);
        setDuration(res.data.config.duration);
        setFeatures(res.data.config.features || []);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setApiError(null);
    setSuccessMsg(null);
    try {
      const res = await http.put("/api/v1/admin/subscriptions/platform-config", {
        price: Number(price),
        currency,
        duration,
        features
      });

      if (res.data?.success) {
        setSuccessMsg("Platform subscription updated successfully");
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

  return (
    <div className="min-h-screen w-full bg-[#0a0808] text-white" style={backgroundStyle}>
      <div className="mx-auto w-full max-w-[800px] px-4 sm:px-6 py-6 sm:py-8">
        <div className="mt-10">
          <div className="text-[38px] leading-[46px] font-light tracking-wide text-[#e6d6d2]">
            Subscription Settings
          </div>
          <div className="mt-2 text-[13px] text-[#b8a6a1]">Manage the global Platform Subscription price and features.</div>
        </div>

        {apiError ? (
          <div className="mt-6 rounded-[6px] border border-[#e3a1a1]/25 bg-[#7a4b28]/30 px-4 py-3 text-[13px] text-[#e3a1a1]">
            Error: {apiError}
          </div>
        ) : null}

        {successMsg ? (
          <div className="mt-6 rounded-[6px] border border-[#a1e3a1]/25 bg-[#287a28]/30 px-4 py-3 text-[13px] text-[#a1e3a1]">
            {successMsg}
          </div>
        ) : null}

        <div className="mt-8 space-y-6 rounded-[12px] border border-white/10 bg-[#141010]/35 backdrop-blur p-8 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          {loading ? (
            <div className="py-10 text-center text-[#a99792]">Loading configuration...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[12px] tracking-wide text-[#b8a6a1] uppercase">Price (₹)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-2 w-full h-[44px] rounded-[8px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-[12px] tracking-wide text-[#b8a6a1] uppercase">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-2 w-full h-[44px] rounded-[8px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[12px] tracking-wide text-[#b8a6a1] uppercase">Plan Features</label>
                <div className="mt-3 space-y-2">
                  {features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3 group">
                      <div className="flex-1 h-[40px] flex items-center px-4 rounded-[6px] bg-white/5 border border-white/5 text-[13px] text-[#cdbdb8]">
                        {feat}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="h-[32px] w-[32px] flex items-center justify-center rounded-full hover:bg-white/10 text-[#8d7b77] hover:text-[#e3a1a1]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="text"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      placeholder="Add a new feature..."
                      className="flex-1 h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[13px] text-[#e6d6d2] outline-none"
                    />
                    <button
                      type="button"
                      onClick={addFeature}
                      className="h-[40px] px-4 rounded-[6px] border border-white/10 bg-white/5 text-[12px] text-[#d8c7c3] hover:bg-white/10"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="h-[44px] px-8 rounded-[8px] bg-gradient-to-b from-[#6a352c] to-[#361c18] border border-[#7a3f31]/30 text-[14px] font-medium tracking-wide text-[#e6d6d2] shadow-lg hover:brightness-110 disabled:opacity-60 transition-all"
                >
                  {saving ? "Saving Changes..." : "Save Configuration"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
