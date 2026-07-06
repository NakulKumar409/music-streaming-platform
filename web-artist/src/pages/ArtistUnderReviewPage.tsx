import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";

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
    <div className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-surface/80 border border-white/10 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
        </svg>
      </div>
    </div>
  );
}

export default function ArtistUnderReviewPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.18) 0%, rgba(75,25,39,0.9) 55%, rgba(10,8,8,0.97) 100%)"
    } as const;
  }, []);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await http.get<MeResponse>("/api/v1/artist/me");
      const s = (res.data?.artist?.status ?? "").toString().toUpperCase();
      const artistStatus = (res.data?.artist?.artistStatus ?? "").toString().toUpperCase();
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
      setError(e?.response?.data?.message || e?.message || "Failed to refresh status");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#4b1927] text-white relative" style={backgroundStyle}>
      <Link
        to="/artist/landing"
        className="absolute top-6 left-6 text-[#b8a6a1] hover:text-[#e6d6d2] flex items-center gap-2 text-sm font-medium transition-colors"
        onClick={() => localStorage.removeItem("artistToken")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Landing Page
      </Link>
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="w-full max-w-[720px] rounded-[10px] border border-white/10 bg-surface/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)] px-10 py-10">
          <div className="flex items-center gap-4">
            <PremiumPlayLogo />
            <div>
              <div className="text-[22px] font-light tracking-wide text-[#e6d6d2]">Under Review</div>
              <div className="mt-2 text-[13px] text-[#b8a6a1]">Your artist application is being reviewed by an admin.</div>
            </div>
          </div>

          <div className="mt-6 text-[13px] text-[#cdbdb8] leading-6">
            You’ll get access to the dashboard as soon as your application is approved.
          </div>

          {error ? <div className="mt-4 text-[13px] text-[#e3a1a1]">{error}</div> : null}

          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              disabled={busy}
              onClick={refresh}
              className="h-[42px] px-5 rounded-[7px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[14px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
            >
              {busy ? "Refreshing..." : "Refresh status"}
            </button>

            <Link
              to="/artist/login"
              className="text-[13px] text-[#a99792] hover:text-[#e6d6d2]"
              onClick={() => localStorage.removeItem("artistToken")}
            >
              Log out
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
