// src/pages/ArtistAccountInactivePage.tsx
import { ArrowLeft, Clock, LogOut, UserX } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

function PremiumPlayLogo() {
  return (
    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary p-[3px] shadow-lg shadow-primary/25">
      <div className="h-full w-full rounded-full bg-background border border-white/10 flex items-center justify-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="var(--color-primary)" />
        </svg>
      </div>
    </div>
  );
}

export default function ArtistAccountInactivePage() {
  const navigate = useNavigate();

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.12) 0%, rgba(10,10,10,0.98) 100%)",
    } as const;
  }, []);

  return (
    <div
      className="min-h-screen w-full bg-background text-white font-sans antialiased"
      style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-[560px] animate-fadeIn">
          <div className="rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <PremiumPlayLogo />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    Account Inactive
                  </h1>
                  <UserX className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm text-[#B8A6A1] leading-relaxed">
                  Your account is currently inactive. Please contact support for
                  more details.
                </p>
              </div>
            </div>

            {/* Info Card */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-[#B8A6A1] leading-relaxed">
                    While inactive, your profile and content are hidden from the
                    Fan App. Your data remains safe and will be restored once
                    your account is reactivated.
                  </p>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-xs text-[#8D7B77] uppercase tracking-wider font-medium">
                Status: Suspended
              </span>
              <span className="text-xs text-[#8D7B77]">•</span>
              <span className="text-xs text-[#8D7B77]">
                Contact support to resolve
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("artistToken");
                  navigate("/artist/login", { replace: true });
                }}
                className="inline-flex items-center gap-2 h-[44px] px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
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
              <p className="text-xs text-[#6b5b57] text-center">
                Need help? Contact our support team at{" "}
                <span className="text-primary">support@artiststudio.com</span>
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
