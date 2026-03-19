import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";

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
    <div className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-[#1a1414]/80 border border-white/10 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
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
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.18) 0%, rgba(75,25,39,0.9) 55%, rgba(10,8,8,0.97) 100%)"
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
      setPortfolio(Array.isArray(a.portfolioLinks) ? a.portfolioLinks.join("\n") : "");
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
        portfolioLinks
      });

      if (!res.data?.success) {
        setError(res.data?.message || "Failed to resubmit");
        return;
      }

      navigate("/artist/under-review", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to resubmit");
    } finally {
      setBusy(false);
    }
  };

  const submitAppeal = async () => {
    setBusy(true);
    setError(null);
    setAppealInfo(null);

    try {
      const res = await http.patch("/api/v1/artist/appeal", { message: appealMessage });
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to submit appeal");
        return;
      }
      setAppealInfo("Appeal sent to admin.");
      setAppealOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to submit appeal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#4b1927] text-white" style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[860px] rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)] px-10 py-10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <PremiumPlayLogo />
              <div>
                <div className="text-[22px] font-light tracking-wide text-[#e6d6d2]">Application Rejected</div>
                <div className="mt-2 text-[13px] text-[#b8a6a1]">
                  You can edit your application and re-submit for review.
                </div>
              </div>
            </div>

            <Link
              to="/artist/login"
              className="text-[13px] text-[#a99792] hover:text-[#e6d6d2]"
              onClick={() => localStorage.removeItem("artistToken")}
            >
              Log out
            </Link>
          </div>

          {loading ? (
            <div className="mt-8 text-[13px] text-[#a99792]">Loading...</div>
          ) : null}

          {adminNote ? (
            <div className="mt-6 rounded-[8px] border border-[#e3a1a1]/20 bg-[#2a1010]/30 px-5 py-4">
              <div className="text-[12px] tracking-wide text-[#b8a6a1]">Admin note</div>
              <div className="mt-2 text-[13px] text-[#e6d6d2] leading-6">{adminNote}</div>
            </div>
          ) : null}

          {error ? <div className="mt-4 text-[13px] text-[#e3a1a1]">{error}</div> : null}
          {appealInfo ? <div className="mt-4 text-[13px] text-[#bfe6bf]">{appealInfo}</div> : null}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[13px] text-[#b8a6a1]">Email</div>
              <input
                value={email}
                disabled
                className="mt-2 w-full h-[44px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none opacity-70"
              />
            </div>

            <div>
              <div className="text-[13px] text-[#b8a6a1]">Artist / Stage Name</div>
              <input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                className="mt-2 w-full h-[44px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                placeholder="Your artist name"
                autoComplete="nickname"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-[13px] text-[#b8a6a1]">Bio</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-2 w-full min-h-[120px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-[13px] text-[#b8a6a1]">Portfolio Links</div>
              <div className="mt-2 text-[12px] text-[#8d7b77]">One URL per line</div>
              <textarea
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
                className="mt-2 w-full min-h-[110px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAppealOpen(true)}
                className="h-[40px] px-4 rounded-[7px] border border-white/10 bg-[#141010]/35 text-[13px] text-[#d8c7c3] hover:border-white/20 disabled:opacity-60"
              >
                Appeal
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={resubmit}
                className="h-[46px] px-6 rounded-[7px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[15px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
              >
                {busy ? "Submitting..." : "Re-submit application"}
              </button>
            </div>
          </div>

          {appealOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
              <div className="w-full max-w-[560px] rounded-[10px] border border-white/10 bg-[#141010]/95 backdrop-blur px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
                <div className="text-[16px] tracking-wide text-[#e6d6d2]">Appeal to Admin</div>
                <div className="mt-2 text-[12px] text-[#8d7b77]">Explain why your application should be reconsidered.</div>

                <textarea
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  className="mt-4 w-full min-h-[140px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="Write your message..."
                />

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAppealOpen(false)}
                    className="h-[36px] px-4 rounded-[6px] border border-white/10 bg-[#0e0a0a]/35 text-[13px] text-[#d8c7c3] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={submitAppeal}
                    className="h-[36px] px-4 rounded-[6px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[13px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.45)] disabled:opacity-60"
                  >
                    {busy ? "Sending..." : "Send appeal"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
