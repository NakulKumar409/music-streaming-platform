import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";

type MeResponse = {
  success: boolean;
  artist?: {
    id: number;
    email: string;
    name: string | null;
    status: string;
    artistStatus?: string;
    artistBio?: string | null;
    portfolioLinks?: string[];
  };
};

type OnboardResponse = {
  success: boolean;
  token?: string;
  pendingApproval?: boolean;
  user?: {
    id: number;
    email: string;
    role?: string;
    isVerified?: boolean;
    status?: string;
  };
  message?: string;
};

function PremiumPlayLogo() {
  return (
    <div className="h-[48px] w-[48px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-[#1a1414]/80 border border-white/10 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
        </svg>
      </div>
    </div>
  );
}

export default function ArtistSignupPage() {
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [artistName, setArtistName] = useState("");
  const [bio, setBio] = useState("");
  const [portfolio, setPortfolio] = useState("");

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.22) 0%, rgba(30,18,18,0.75) 40%, rgba(10,8,8,0.97) 100%)"
    } as const;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = localStorage.getItem("artistToken");
      if (!token) return;

      try {
        const res = await http.get<MeResponse>("/api/v1/artist/me");
        if (!mounted) return;
        const a = res.data?.artist;
        if (!a) return;

        setEmail(a.email ?? "");
        setArtistName(a.name ?? "");
        setBio((a.artistBio ?? "").toString());
        setPortfolio(Array.isArray(a.portfolioLinks) ? a.portfolioLinks.join("\n") : "");
      } catch {
        return;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);

    try {
      const token = localStorage.getItem("artistToken");
      const portfolioLinks = portfolio
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      const res = token
        ? await http.patch<OnboardResponse>("/api/v1/artist/onboard", {
            artistName,
            bio,
            portfolioLinks
          })
        : await http.post<OnboardResponse>("/api/v1/artist/onboard", {
            email,
            password,
            artistName,
            bio,
            portfolioLinks
          });

      if (!res.data?.success) {
        setError(res.data?.message || "Failed to submit application");
        return;
      }

      if (!token && res.data?.token) {
        localStorage.setItem("artistToken", res.data.token);
      }

      navigate("/artist/under-review", { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to submit application";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#4b1927] text-white" style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[720px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <PremiumPlayLogo />
              <div>
                <div className="text-[22px] font-light tracking-wide text-[#e6d6d2]">Artist Application</div>
                <div className="mt-2 text-[13px] text-[#b8a6a1]">Submit your details for admin review.</div>
              </div>
            </div>
            <Link to="/artist/login" className="text-[13px] text-[#a99792] hover:text-[#e6d6d2]">
              Log in
            </Link>
          </div>

          <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)] px-10 py-10">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-[13px] text-[#b8a6a1]">Email</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={Boolean(localStorage.getItem("artistToken"))}
                    className="mt-2 w-full h-[44px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                    placeholder="artist@example.com"
                    autoComplete="email"
                  />
                </div>

                {!localStorage.getItem("artistToken") ? (
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Password</div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-2 w-full h-[44px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="Create a password"
                      autoComplete="new-password"
                    />
                  </div>
                ) : (
                  <div />
                )}
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

              <div>
                <div className="text-[13px] text-[#b8a6a1]">Bio</div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-2 w-full min-h-[120px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="Tell us about your music and background"
                />
              </div>

              <div>
                <div className="text-[13px] text-[#b8a6a1]">Portfolio Links</div>
                <div className="mt-2 text-[12px] text-[#8d7b77]">One URL per line (YouTube, Spotify, SoundCloud, Instagram, website, etc.)</div>
                <textarea
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  className="mt-2 w-full min-h-[110px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="https://..."
                />
              </div>

              {error ? <div className="text-[13px] text-[#e3a1a1]">{error}</div> : null}

              <div className="flex items-center justify-between pt-2">
                <Link
                  to="/artist/login"
                  className="text-[13px] text-[#a99792] hover:text-[#e6d6d2]"
                >
                  Already have an account?
                </Link>

                <button
                  type="button"
                  disabled={busy}
                  onClick={onSubmit}
                  className="h-[46px] px-6 rounded-[7px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[15px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
                >
                  {busy ? "Submitting..." : "Submit application"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
