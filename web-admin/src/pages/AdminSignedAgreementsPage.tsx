import { useState, useEffect } from "react";
import { http } from "../services/http";
import { Download, Eye, CheckCircle, XCircle, Clock, Shield, FileText, Search } from "lucide-react";

type SignedAgreement = {
  id: number;
  name: string;
  email: string;
  agreementId: string;
  agreementVersion: string;
  termsVersion: string;
  artistRevenueShare: number;
  platformRevenueShare: number;
  agreementStatus: string;
  agreementAcceptedAt: string;
  agreementPdfPath: string;
  digitalSignature: string;
  signatureIpAddress: string;
  signatureUserAgent: string;
};

export default function AdminSignedAgreementsPage() {
  const [agreements, setAgreements] = useState<SignedAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const res = await http.get("/api/v1/admin/artists", {
        params: { limit: 200 }
      });
      if (res.data?.success) {
        const artists = res.data.items || [];
        const signedAgreements = artists.filter((a: any) => 
          a.agreementAccepted && 
          a.agreementId && 
          a.agreementStatus === "ACTIVE"
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
      agreement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.agreementId.toLowerCase().includes(searchTerm.toLowerCase())
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={12} />
            Active
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock size={12} />
            Pending
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={12} />
            Rejected
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            {status}
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
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#8D7B77] focus:outline-none focus:border-[#E85D2C]"
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
              : "No artists have active signed agreements yet"}
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
                <tr key={agreement.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-mono">{agreement.agreementId.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white">{agreement.name}</div>
                      <div className="text-xs text-[#8D7B77]">{agreement.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">v{agreement.agreementVersion}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="text-[#E85D2C]">{agreement.artistRevenueShare}%</span>
                      <span className="text-[#8D7B77]"> / </span>
                      <span className="text-[#C97A54]">{agreement.platformRevenueShare}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{agreement.termsVersion}</div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(agreement.agreementStatus)}</td>
                  <td className="px-4 py-3 text-sm text-[#8D7B77]">
                    {new Date(agreement.agreementAcceptedAt).toLocaleDateString()}
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
                        onClick={() => {/* TODO: View signature */}}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                        title="View Signature"
                      >
                        <Shield size={18} />
                      </button>
                      <button
                        onClick={() => {/* TODO: View audit history */}}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#8D7B77] hover:text-white transition-colors"
                        title="Audit History"
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
    </div>
  );
}
