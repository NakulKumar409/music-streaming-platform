import { useState, useEffect } from "react";
import { http } from "../services/http";
import { Plus, Edit, Trash2, Copy, Eye, CheckCircle, XCircle, DollarSign } from "lucide-react";

type CommissionPlan = {
  id: number;
  version: string;
  name: string;
  description: string;
  benefits: string[];
  artistShare: number;
  platformShare: number;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminCommissionPlansPage() {
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CommissionPlan | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await http.get("/api/v1/admin/artists/revenue-share-config");
      console.log("Commission plans response:", res.data);
      if (res.data?.success) {
        setPlans(res.data.configs || []);
      }
    } catch (error) {
      console.error("Failed to fetch commission plans:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (data: any) => {
    try {
      await http.post("/api/v1/admin/artists/revenue-share-config", data);
      setShowCreateModal(false);
      fetchPlans();
    } catch (error) {
      console.error("Failed to create plan:", error);
    }
  };

  const handleToggleStatus = async (plan: CommissionPlan) => {
    try {
      await http.put(`/api/v1/admin/artists/revenue-share-config/${plan.id}`, {
        isActive: !plan.isActive,
      });
      fetchPlans();
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  };

  const handleEditPlan = async (plan: CommissionPlan) => {
    const newArtistShare = prompt("Enter new artist share %:", String(plan.artistShare));
    if (newArtistShare === null) return;
    const artistShareNum = parseInt(newArtistShare);
    if (isNaN(artistShareNum) || artistShareNum < 0 || artistShareNum > 100) {
      alert("Invalid artist share");
      return;
    }
    try {
      await http.put(`/api/v1/admin/artists/revenue-share-config/${plan.id}`, {
        artistShare: artistShareNum,
        platformShare: 100 - artistShareNum,
      });
      fetchPlans();
    } catch (error) {
      console.error("Failed to edit plan:", error);
    }
  };

  const handleDuplicatePlan = async (plan: CommissionPlan) => {
    try {
      await http.post("/api/v1/admin/artists/revenue-share-config", {
        version: plan.version,
        artistShare: plan.artistShare,
        platformShare: plan.platformShare,
      });
      fetchPlans();
    } catch (error) {
      console.error("Failed to duplicate plan:", error);
    }
  };

  const handleDeletePlan = async (plan: CommissionPlan) => {
    if (!confirm("Are you sure you want to delete this commission plan?")) return;
    try {
      await http.delete(`/api/v1/admin/artists/revenue-share-config/${plan.id}`);
      fetchPlans();
    } catch (error) {
      console.error("Failed to delete plan:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E85D2C]/20 text-[#E85D2C]">
            <DollarSign size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Commission Plans</h1>
            <p className="text-sm text-[#8D7B77]">Manage revenue sharing plans for artists</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#E85D2C] text-white rounded-lg hover:bg-[#E85D2C]/90 transition-colors"
        >
          <Plus size={18} />
          Create Plan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-[#E85D2C]/30 border-t-[#E85D2C] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8D7B77]">Loading plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <DollarSign className="w-16 h-16 text-[#8D7B77] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Commission Plans</h3>
          <p className="text-sm text-[#8D7B77] mb-4">Create your first commission plan to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#E85D2C] text-white rounded-lg hover:bg-[#E85D2C]/90 transition-colors"
          >
            <Plus size={18} />
            Create Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`p-6 rounded-xl border ${
                plan.isActive
                  ? "bg-[#E85D2C]/5 border-[#E85D2C]/20"
                  : "bg-white/5 border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{plan.name || plan.version}</h3>
                    {plan.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <XCircle size={12} />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#8D7B77] mb-2">{plan.description}</p>
                  <p className="text-xs text-[#8D7B77]">
                    Effective from: {new Date(plan.effectiveFrom).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditPlan(plan)}
                    className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                    title="Edit Plan"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDuplicatePlan(plan)}
                    className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                    title="Duplicate Plan"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => handleToggleStatus(plan)}
                    className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                    title={plan.isActive ? "Deactivate" : "Activate"}
                  >
                    {plan.isActive ? <XCircle size={18} /> : <CheckCircle size={18} />}
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan)}
                    className="p-2 rounded-lg hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
                    title="Delete Plan"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-3xl font-bold text-[#E85D2C]">{plan.artistShare}%</div>
                  <div className="text-sm text-[#8D7B77]">Artist Share</div>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-3xl font-bold text-[#C97A54]">{plan.platformShare}%</div>
                  <div className="text-sm text-[#8D7B77]">Platform Share</div>
                </div>
              </div>

              {plan.benefits && plan.benefits.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-2">Benefits</div>
                  <ul className="space-y-1">
                    {plan.benefits.map((benefit, index) => (
                      <li key={index} className="text-sm text-[#B8A6A1] flex items-start gap-2">
                        <span className="text-[#E85D2C] mt-1">•</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-[#8D7B77]">
                Created: {new Date(plan.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create Commission Plan</h2>
            <CreatePlanForm
              onSubmit={handleCreatePlan}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePlanForm({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) {
  const [planType, setPlanType] = useState("");
  const [artistShare, setArtistShare] = useState(50);
  const [platformShare, setPlatformShare] = useState(50);

  const planPresets = {
    basic: { artistShare: 70, platformShare: 30 },
    growth: { artistShare: 65, platformShare: 35 },
    pro: { artistShare: 60, platformShare: 40 },
    managed: { artistShare: 55, platformShare: 45 }
  };

  const handlePlanTypeChange = (type: string) => {
    setPlanType(type);
    if (type && planPresets[type as keyof typeof planPresets]) {
      const preset = planPresets[type as keyof typeof planPresets];
      setArtistShare(preset.artistShare);
      setPlatformShare(preset.platformShare);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ version: planType, artistShare, platformShare });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#8D7B77] mb-2">Plan Type</label>
        <select
          value={planType}
          onChange={(e) => handlePlanTypeChange(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#E85D2C]"
        >
          <option value="" className="text-[#5a4a46]">Select plan type</option>
          <option value="basic" className="text-white bg-[#1a1210]">Basic (70% Artist / 30% Platform)</option>
          <option value="growth" className="text-white bg-[#1a1210]">Growth (65% Artist / 35% Platform)</option>
          <option value="pro" className="text-white bg-[#1a1210]">Pro (60% Artist / 40% Platform)</option>
          <option value="managed" className="text-white bg-[#1a1210]">Managed (55% Artist / 45% Platform)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#8D7B77] mb-2">Artist Share (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={artistShare}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0;
            setArtistShare(val);
            setPlatformShare(100 - val);
          }}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#E85D2C]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#8D7B77] mb-2">Platform Share (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={platformShare}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0;
            setPlatformShare(val);
            setArtistShare(100 - val);
          }}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#E85D2C]"
        />
      </div>
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 bg-[#E85D2C] text-white rounded-lg hover:bg-[#E85D2C]/90 transition-colors"
        >
          Create Plan
        </button>
      </div>
    </form>
  );
}
