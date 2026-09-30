import { useState, useEffect } from "react";
import { http } from "../services/http";
import { Download, Eye, CheckCircle, XCircle, Clock, Shield, FileText, Search, X } from "lucide-react";

type SignedAgreement = {
  id: number;
  name: string;
  email: string;
  agreementId: string | null;
  agreementVersion: string | null;
  termsVersion: string | null;
  artistRevenueShare: number | null;
  platformRevenueShare: number | null;
  agreementStatus: string | null;
  agreementAcceptedAt: string | null;
  agreementPdfPath: string | null;
  digitalSignature: string | null;
  signatureSignedAt?: string | null;
  signatureIpAddress: string | null;
  signatureUserAgent: string | null;
};

function safeSignatureUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return null;
}

export default function AdminSignedAgreementsPage() {
  const [agreements, setAgreements] = useState<SignedAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSignature, setSelectedSignature] = useState<SignedAgreement | null>(null);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const res = await http.get("/api/v1/admin/artists", {
        params: { limit: 200 }
      });
      if (res.data?.success) {
        const artists = res.data.items || [];
        const signedAgreements = artists.filter((a: any) => 
          Boolean(a.agreementAccepted || a.digitalSignature || a.agreementId)
        );
        setAgreements(signedAgreements);
      }
    } catch (error) {
      console.error("Failed to fetch agreements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, []);

  const filteredAgreements = agreements.filter((agreement) => {
    return (
      (agreement.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agreement.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agreement.agreementId || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleDownloadPdf = async (artistId: number) => {
    try {
      const res = await http.get(`/api/v1/admin/artists/${artistId}/agreement-pdf`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `agreement-${artistId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to download PDF:", error);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={12} />
            Active
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock size={12} />
            Pending Approval
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={12} />
            Rejected
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock size={12} />
            {status || "Pending"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Signed Agreements</h1>
          <p className="text-sm text-[#8D7B77]">View and manage all signed artist agreements</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8D7B77]" />
          <input
            type="text"
            placeholder="Search by name, email, or agreement ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#8D7B77] focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8D7B77]">Loading agreements...</p>
        </div>
      ) : filteredAgreements.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <FileText className="w-16 h-16 text-[#8D7B77] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Signed Agreements</h3>
          <p className="text-sm text-[#8D7B77]">
            {searchTerm
              ? "No agreements match your search criteria"
              : "No artists have signed agreements yet"}
          </p>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Agreement #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Artist</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Plan</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Commission</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Terms Version</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Signed Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#8D7B77]">Document Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-[#8D7B77]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgreements.map((agreement) => (
                <tr key={agreement.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-mono">
                      {agreement.agreementId ? `${agreement.agreementId.slice(0, 8)}...` : `AGR-${agreement.id}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white">{agreement.name || `Artist #${agreement.id}`}</div>
                      <div className="text-xs text-[#8D7B77]">{agreement.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">v{agreement.agreementVersion || "1.0"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="text-primary font-medium">{agreement.artistRevenueShare ?? 90}%</span>
                      <span className="text-[#8D7B77]"> / </span>
                      <span className="text-secondary">{agreement.platformRevenueShare ?? 10}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{agreement.termsVersion || "v1.0"}</div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(agreement.agreementStatus)}</td>
                  <td className="px-4 py-3 text-sm text-[#8D7B77]">
                    {agreement.agreementAcceptedAt
                      ? new Date(agreement.agreementAcceptedAt).toLocaleDateString()
                      : (agreement.signatureSignedAt ? new Date(agreement.signatureSignedAt).toLocaleDateString() : "Pending Approval")}
                  </td>
                  <td className="px-4 py-3">
                    {agreement.agreementPdfPath ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={12} />
                        Generated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => window.open(`/admin/artists/${agreement.id}`, "_blank")}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                        title="View Artist"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(agreement.id)}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                        title="Download PDF"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => setSelectedSignature(agreement)}
                        className="p-2 rounded-lg hover:bg-purple-500/20 text-[#8D7B77] hover:text-purple-300 transition-colors"
                        title="View Signature"
                      >
                        <Shield size={18} />
                      </button>
                      <button
                        onClick={() => window.open(`/admin/artists/${agreement.id}`, "_blank")}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                        title="View Agreement in Artist Details"
                      >
                        <FileText size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signature Preview Modal */}
      {selectedSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="text-primary w-5 h-5" />
                <h3 className="font-bold text-lg text-white">Digital Signature Record</h3>
              </div>
              <button
                onClick={() => setSelectedSignature(null)}
                className="p-1 rounded-lg text-[#8D7B77] hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-[#8D7B77] uppercase font-semibold">Artist</p>
                <p className="text-white font-medium text-sm mt-0.5">{selectedSignature.name} ({selectedSignature.email})</p>
              </div>

              <div>
                <p className="text-xs text-[#8D7B77] uppercase font-semibold mb-2">Digital Signature</p>
                {safeSignatureUrl(selectedSignature.digitalSignature) ? (
                  <div className="p-4 bg-black/50 border border-white/10 rounded-xl flex items-center justify-center">
                    <img
                      src={safeSignatureUrl(selectedSignature.digitalSignature)!}
                      alt="Digital Signature"
                      className="max-h-24 max-w-full object-contain filter invert opacity-90"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-black/30 border border-white/10 rounded-xl text-center text-xs text-[#8D7B77]">
                    {selectedSignature.digitalSignature
                      ? `Text Signature: "${selectedSignature.digitalSignature}"`
                      : "No signature image recorded"}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                  <p className="text-[#8D7B77] font-semibold">IP Address</p>
                  <p className="text-white mt-1 font-mono">{selectedSignature.signatureIpAddress || "—"}</p>
                </div>
                <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                  <p className="text-[#8D7B77] font-semibold">Signed Date</p>
                  <p className="text-white mt-1">
                    {selectedSignature.agreementAcceptedAt
                      ? new Date(selectedSignature.agreementAcceptedAt).toLocaleString()
                      : "Pending Approval"}
                  </p>
                </div>
              </div>

              {selectedSignature.signatureUserAgent && (
                <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-xs">
                  <p className="text-[#8D7B77] font-semibold">User Agent</p>
                  <p className="text-white mt-1 font-mono text-[11px] break-all">{selectedSignature.signatureUserAgent}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedSignature(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
