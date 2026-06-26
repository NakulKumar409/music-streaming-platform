// src/pages/ArtistUnderReviewPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";
import {
  Clock,
  LogOut,
  RefreshCw,
  Loader2,
  Shield,
  AlertCircle,
  FileCheck,
  ArrowLeft,
  UserCheck,
  Hourglass,
  Mail,
} from "lucide-react";

type MeResponse = {
  success: boolean;
  artist?: {
    artistStatus?: string;
    isVerified?: boolean;
    status?: string;
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

export default function ArtistUnderReviewPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.10) 0%, rgba(10,10,10,0.98) 100%)",
    } as const;
  }, []);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    setLastChecked(new Date());
    try {
      const res = await http.get<MeResponse>("/api/v1/artist/me");
      const s = (res.data?.artist?.status ?? "").toString().toUpperCase();
      const artistStatus = (res.data?.artist?.artistStatus ?? "")
        .toString()
        .toUpperCase();
      const isVerified = Boolean(res.data?.artist?.isVerified);

      if (s && s !== "ACTIVE") {
        localStorage.removeItem("artistToken");
        navigate("/artist/login", { replace: true });
        return;
      }

      if (artistStatus === "APPROVED" || isVerified) {
        navigate("/artist/dashboard", { replace: true });
        return;
      }

      if (artistStatus === "REJECTED") {
        navigate("/artist/rejected", { replace: true });
        return;
      }

      setError("Still under review. Please try again shortly.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("artistToken");
        navigate("/artist/login", { replace: true });
        return;
      }
      setError(
        e?.response?.data?.message || e?.message || "Failed to refresh status"
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen w-full bg-[#0A0A0A] text-white font-sans antialiased relative"
      style={backgroundStyle}>
      {/* Back Button */}
      <Link
        to="/artist/landing"
        className="absolute top-6 left-6 text-[#B8A6A1] hover:text-white flex items-center gap-2 text-sm font-medium transition-colors z-10"
        onClick={() => localStorage.removeItem("artistToken")}>
        <ArrowLeft className="w-4 h-4" />
        Back to Landing Page
      </Link>

      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-[520px] animate-fadeIn">
          {/* Main Card */}
          <div className="rounded-2xl border border-white/10 bg-[#15100E]/80 backdrop-blur-xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <PremiumPlayLogo />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    Under Review
                  </h1>
                  <FileCheck className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-sm text-[#B8A6A1] leading-relaxed">
                  Your artist application is being reviewed by an admin.
                </p>
              </div>
            </div>

            {/* Status Steps */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckIcon className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Application Submitted
                  </p>
                  <p className="text-xs text-[#8D7B77]">
                    Your application has been received
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Under Review</p>
                  <p className="text-xs text-[#8D7B77]">
                    Admin is reviewing your application
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 opacity-40">
                <div className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserCheck className="w-4 h-4 text-[#6b5b57]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#6b5b57]">
                    Approval Decision
                  </p>
                  <p className="text-xs text-[#6b5b57]">
                    You'll be notified once reviewed
                  </p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-[#B8A6A1] leading-relaxed">
                    You'll get access to the dashboard as soon as your
                    application is approved. This usually takes 24-48 hours.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Last Checked */}
            {lastChecked && !error && (
              <p className="text-xs text-[#6b5b57] text-center mb-4">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={refresh}
                className="inline-flex items-center gap-2 h-[44px] px-6 rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-sm font-semibold text-white shadow-lg shadow-[#E85D2C]/25 hover:shadow-[#E85D2C]/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Refresh Status
                  </>
                )}
              </button>

              <Link
                to="/artist/login"
                className="inline-flex items-center gap-2 h-[44px] px-6 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-[#B8A6A1] hover:text-white hover:bg-white/10 transition-all"
                onClick={() => localStorage.removeItem("artistToken")}>
                <LogOut className="w-4 h-4" />
                Logout
              </Link>
            </div>

            {/* Support Note */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-xs text-[#6b5b57] text-center flex items-center justify-center gap-1.5">
                <Mail className="w-3 h-3" />
                Questions? Contact support at{" "}
                <span className="text-[#E85D2C]">support@artiststudio.com</span>
              </p>
            </div>
          </div>
        </div>
      </div>

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

// Helper Check Icon Component
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
