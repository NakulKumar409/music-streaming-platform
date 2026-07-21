// src/pages/PendingApprovalPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";
import {
  Clock,
  LogOut,
  RefreshCw,
  Loader2,
  Shield,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Hourglass,
  Mail,
} from "lucide-react";

type MeResponse = {
  success: boolean;
  artist?: {
    id?: number;
    isVerified?: boolean;
    status?: string;
  };
};

function PremiumPlayLogo() {
  return (
    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary p-[3px] shadow-lg shadow-primary/25">
      <div className="h-full w-full rounded-full bg-background border border-white/10 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="var(--color-primary)" />
        </svg>
      </div>
    </div>
  );
}

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: 
        "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.10) 0%, rgba(10,10,10,0.98) 100%)"
    } as const;
  }, []);

  const checkStatus = async () => {
    setBusy(true);
    setError(null);
    setStatusChecked(true);
    try {
      const res = await http.get<MeResponse>("/api/v1/artist/me");
      const isVerified = Boolean(res.data?.artist?.isVerified);
      const status = (res.data?.artist?.status || "").toString().toUpperCase();
      if (isVerified && status === "ACTIVE") {
        navigate("/artist/dashboard", { replace: true });
        return;
      }
      setError("Not verified yet. Please try again shortly.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("artistToken");
        navigate("/artist/login", { replace: true });
        return;
      }
      setError(e?.response?.data?.message || e?.message || "Failed to refresh status");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen w-full bg-background text-white font-sans antialiased" style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-[520px] animate-fadeIn">
          
          {/* Main Card */}
          <div className="rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12">
            
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <PremiumPlayLogo />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Waiting for Approval</h1>
                  <Hourglass className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <p className="text-sm text-[#B8A6A1] leading-relaxed">
                  Your artist account has been created but is not verified yet.
                </p>
              </div>
            </div>

            {/* Status Steps */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Account Created</p>
                  <p className="text-xs text-[#8D7B77]">Your artist account has been successfully created</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Awaiting Verification</p>
                  <p className="text-xs text-[#8D7B77]">Admin is reviewing your application</p>
                </div>
              </div>

              <div className="flex items-start gap-3 opacity-40">
                <div className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserCheck className="w-4 h-4 text-[#6b5b57]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#6b5b57]">Access Granted</p>
                  <p className="text-xs text-[#6b5b57]">You'll get access to all artist features</p>
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
                    Once an admin verifies your account, you'll be able to access all artist features including uploading content, analytics, and monetization.
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

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={checkStatus}
                className="inline-flex items-center gap-2 h-[44px] px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
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
                onClick={() => localStorage.removeItem("artistToken")}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Link>
            </div>

            {/* Support Note */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-xs text-[#6b5b57] text-center flex items-center justify-center gap-1.5">
                <Mail className="w-3 h-3" />
                Need help? Contact support at <span className="text-primary">support@artiststudio.com</span>
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