import { useState, useEffect } from "react";
import { http } from "../services/http";
import { Plus, Eye, CheckCircle, XCircle, Shield, FileText } from "lucide-react";

type TermsVersion = {
  version: string;
  content: string;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AdminTermsManagementPage() {
  const [terms, setTerms] = useState<TermsVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTerms, setPreviewTerms] = useState<TermsVersion | null>(null);

  const fetchTerms = async () => {
    setLoading(true);
    try {
      const res = await http.get("/api/v1/admin/artists/terms-versions");
      console.log("Terms response:", res.data);
      if (res.data?.success) {
        setTerms(res.data.terms || []);
      }
    } catch (error) {
      console.error("Failed to fetch terms:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const handleCreateTerms = async (content: string) => {
    try {
      await http.post("/api/v1/admin/artists/terms-versions", { content });
      setShowCreateModal(false);
      fetchTerms();
    } catch (error) {
      console.error("Failed to create terms:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Terms & Conditions</h1>
            <p className="text-sm text-[#8D7B77]">Manage terms versions and content</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={18} />
          New Version
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8D7B77]">Loading terms...</p>
        </div>
      ) : terms.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <Shield className="w-16 h-16 text-[#8D7B77] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Terms Versions</h3>
          <p className="text-sm text-[#8D7B77] mb-4">Create your first terms version to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={18} />
            Create Terms
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {terms.map((term) => (
            <div
              key={term.version}
              className={`p-6 rounded-xl border ${
                term.isActive
                  ? "bg-blue-500/5 border-blue-500/20"
                  : "bg-white/5 border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{term.version}</h3>
                    {term.isActive ? (
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
                  <p className="text-sm text-[#8D7B77]">
                    Effective from: {new Date(term.effectiveFrom).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewTerms(term)}
                    className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                  >
                    <Eye size={18} />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/5 max-h-32 overflow-hidden">
                <p className="text-sm text-[#8D7B77] line-clamp-3">{term.content}</p>
              </div>

              <div className="flex items-center justify-between mt-4 text-xs text-[#8D7B77]">
                <span>Created: {new Date(term.createdAt).toLocaleString()}</span>
                <span>Updated: {new Date(term.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Create New Terms Version</h2>
            <CreateTermsForm
              onSubmit={handleCreateTerms}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {previewTerms && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">{previewTerms.version}</h2>
              <button
                onClick={() => setPreviewTerms(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-white"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <pre className="text-sm text-[#8D7B77] whitespace-pre-wrap font-sans">
                {previewTerms.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTermsForm({ onSubmit, onCancel }: { onSubmit: (content: string) => void; onCancel: () => void }) {
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#8D7B77] mb-2">Terms Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
          placeholder="Enter terms and conditions content..."
        />
      </div>
      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-xs text-yellow-400">
          <strong>Note:</strong> Creating a new version will automatically deactivate all previous versions. Published terms cannot be edited.
        </p>
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
          disabled={!content.trim()}
          className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Publish Version
        </button>
      </div>
    </form>
  );
}
