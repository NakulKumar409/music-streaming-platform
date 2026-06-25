// src/pages/ArtistRejectedPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";
import {
  AlertCircle,
  LogOut,
  ArrowLeft,
  Send,
  X,
  Loader2,
  UserX,
  Mail,
  User,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  CheckCircle,
  Shield,
  AlertTriangle,
} from "lucide-react";

type MeResponse = {
  success: boolean;
  artist?: {
    email: string;
    name: string | null;
    status: string;
    artistStatus?: string;
    artistBio?: string | null;
    portfolioLinks?: string[];
    adminNote?: string | null;
    appealMessage?: string | null;
  };
};

function PremiumPlayLogo() {
  return (
    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#E85D2C] to-[#C97A54] p-[3px] shadow-lg shadow-[#E85D2C]/25">
      <div className="h-full w-full rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#E85D2C" />
        </svg>
      </div>
    </div>
  );
}

export default function ArtistRejectedPage() {
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [artistName, setArtistName] = useState("");
  const [bio, setBio] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [adminNote, setAdminNote] = useState<string | null>(null);

  const [appealOpen, setAppealOpen] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealInfo, setAppealInfo] = useState<string | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.10) 0%, rgba(10,10,10,0.98) 100%)",
    } as const;
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await http.get<MeResponse>("/api/v1/artist/me");
      const a = res.data?.artist;
      if (!a) throw new Error("Missing artist");

      const status = (a.status ?? "").toString().toUpperCase();
      const artistStatus = (a.artistStatus ?? "").toString().toUpperCase();

      if (status && status !== "ACTIVE") {
        localStorage.removeItem("artistToken");
        navigate("/artist/login", { replace: true });
        return;
      }

      if (artistStatus === "PENDING") {
        navigate("/artist/under-review", { replace: true });
        return;
      }

      if (artistStatus === "APPROVED") {
        navigate("/artist/dashboard", { replace: true });
        return;
      }

      setEmail(a.email ?? "");
      setArtistName(a.name ?? "");
      setBio((a.artistBio ?? "").toString());
      setPortfolio(
        Array.isArray(a.portfolioLinks) ? a.portfolioLinks.join("\n") : ""
      );
      setAdminNote(a.adminNote ?? null);
      setAppealMessage((a.appealMessage ?? "").toString());
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("artistToken");
        navigate("/artist/login", { replace: true });
        return;
      }
      setError(e?.response?.data?.message || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resubmit = async () => {
    setBusy(true);
    setError(null);
    setAppealInfo(null);

    try {
      const portfolioLinks = portfolio
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      const res = await http.patch("/api/v1/artist/onboard", {
        artistName,
        bio,
        portfolioLinks,
      });

      if (!res.data?.success) {
        setError(res.data?.message || "Failed to resubmit");
        return;
      }

      navigate("/artist/under-review", { replace: true });
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to resubmit"
      );
    } finally {
      setBusy(false);
    }
  };

  const submitAppeal = async () => {
    setBusy(true);
    setError(null);
    setAppealInfo(null);

    try {
      const res = await http.patch("/api/v1/artist/appeal", {
        message: appealMessage,
      });
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to submit appeal");
        return;
      }
      setAppealInfo("Appeal sent to admin.");
      setAppealOpen(false);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to submit appeal"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#0A0A0A] text-white font-sans antialiased"
      style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[860px] animate-fadeIn">
          {/* Main Card */}
          <div className="rounded-2xl border border-white/10 bg-[#15100E]/80 backdrop-blur-xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12">
            {/* Header */}
            <div className="flex items-start justify-between gap-6 mb-6">
              <div className="flex items-start gap-4">
                <PremiumPlayLogo />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      Application Rejected
                    </h1>
                    <UserX className="w-5 h-5 text-rose-400" />
                  </div>
                  <p className="text-sm text-[#B8A6A1]">
                    You can edit your application and re-submit for review.
                  </p>
                </div>
              </div>

              <Link
                to="/artist/login"
                className="inline-flex items-center gap-1.5 text-sm text-[#B8A6A1] hover:text-white transition-colors"
                onClick={() => localStorage.removeItem("artistToken")}>
                <LogOut className="w-4 h-4" />
                Log out
              </Link>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#E85D2C] animate-spin" />
              </div>
            )}

            {/* Admin Note */}
            {adminNote && (
              <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                      Admin Note
                    </div>
                    <div className="mt-1 text-sm text-white leading-relaxed">
                      {adminNote}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {appealInfo && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                {appealInfo}
              </div>
            )}

            {/* Form */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  value={email}
                  disabled
                  className="mt-2 w-full h-[44px] rounded-xl bg-[#0A0A0A]/40 border border-white/10 px-4 text-sm text-white outline-none opacity-60 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                  <User className="w-4 h-4" />
                  Artist / Stage Name
                </label>
                <input
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  className="mt-2 w-full h-[44px] rounded-xl bg-[#0A0A0A]/40 border border-white/10 px-4 text-sm text-white placeholder-[#6b5b57] outline-none focus:border-[#E85D2C]/50 transition-all"
                  placeholder="Your artist name"
                  autoComplete="nickname"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                  <FileText className="w-4 h-4" />
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-2 w-full min-h-[120px] rounded-xl bg-[#0A0A0A]/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-[#6b5b57] outline-none focus:border-[#E85D2C]/50 transition-all resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                  <LinkIcon className="w-4 h-4" />
                  Portfolio Links
                </label>
                <p className="mt-1 text-xs text-[#8D7B77]">One URL per line</p>
                <textarea
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  className="mt-2 w-full min-h-[110px] rounded-xl bg-[#0A0A0A]/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-[#6b5b57] outline-none focus:border-[#E85D2C]/50 transition-all resize-none"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAppealOpen(true)}
                  className="inline-flex items-center gap-2 h-[44px] px-5 rounded-xl border border-white/10 bg-[#0A0A0A]/40 text-sm font-medium text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all disabled:opacity-50">
                  <MessageSquare className="w-4 h-4" />
                  Appeal
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={resubmit}
                  className="inline-flex items-center gap-2 h-[46px] px-6 rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-sm font-semibold text-white shadow-lg shadow-[#E85D2C]/25 hover:shadow-[#E85D2C]/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Re-submit Application
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appeal Modal */}
      {appealOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 animate-fadeIn"
          onClick={() => setAppealOpen(false)}>
          <div
            className="w-full max-w-[520px] rounded-2xl border border-white/10 bg-[#15100E] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#E85D2C]" />
                  Appeal to Admin
                </h3>
                <p className="text-sm text-[#B8A6A1] mt-0.5">
                  Explain why your application should be reconsidered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAppealOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[#B8A6A1] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={appealMessage}
              onChange={(e) => setAppealMessage(e.target.value)}
              className="w-full min-h-[140px] rounded-xl bg-[#0A0A0A]/40 border border-white/10 px-4 py-3 text-sm text-white placeholder-[#6b5b57] outline-none focus:border-[#E85D2C]/50 transition-all resize-none"
              placeholder="Write your message..."
            />

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAppealOpen(false)}
                className="h-[40px] px-4 rounded-xl border border-white/10 bg-[#0A0A0A]/40 text-sm font-medium text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitAppeal}
                className="inline-flex items-center gap-2 h-[40px] px-6 rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-sm font-semibold text-white shadow-lg shadow-[#E85D2C]/25 hover:shadow-[#E85D2C]/40 transition-all disabled:opacity-50">
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Appeal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
