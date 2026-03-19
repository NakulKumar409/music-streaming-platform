import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { http } from "../services/http";

type MeResponse = {
  success: boolean;
  artist?: {
    id: number;
    name: string | null;
    email: string;
    isVerified: boolean;
    status: string;
    artistStatus?: string;
    profileImageUrl: string | null;
    accentColor: string | null;
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

export default function ArtistShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [me, setMe] = useState<MeResponse["artist"] | null>(null);

  const apiBaseUrl = useMemo(() => {
    return (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000")
      .toString()
      .replace(/\/$/, "");
  }, []);

  const resolvePublicUrl = (url: string | null) => {
    const raw = (url || "").toString().trim();
    if (!raw) return null;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return `${apiBaseUrl}${raw}`;
    return raw;
  };

  const profileSrc = useMemo(() => {
    return resolvePublicUrl(me?.profileImageUrl ?? null);
  }, [apiBaseUrl, me?.profileImageUrl]);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.16) 0%, rgba(75,25,39,0.88) 55%, rgba(10,8,8,0.97) 100%)"
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

        const artist = res.data?.artist ?? null;
        setMe(artist);

        const status = (artist?.status || "").toUpperCase();
        const artistStatus = (artist as any)?.artistStatus
          ? String((artist as any).artistStatus).toUpperCase()
          : "";
        if (status && status !== "ACTIVE") {
          localStorage.removeItem("artistToken");
          if (location.pathname !== "/artist/login") {
            navigate("/artist/login", { replace: true });
          }
          return;
        }

        if (artistStatus === "PENDING") {
          if (location.pathname !== "/artist/under-review") {
            navigate("/artist/under-review", { replace: true });
          }
          return;
        }

        if (artistStatus === "REJECTED") {
          if (location.pathname !== "/artist/rejected") {
            navigate("/artist/rejected", { replace: true });
          }
          return;
        }

        if (!artistStatus && artist && !artist.isVerified) {
          if (location.pathname !== "/artist/pending-approval") {
            navigate("/artist/pending-approval", { replace: true });
          }
          return;
        }
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem("artistToken");
          if (location.pathname !== "/artist/login") {
            navigate("/artist/login", { replace: true });
          }
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate, location.pathname]);

  const activePath = location.pathname;

  const navItems = useMemo(
    () => {
      const status = (me as any)?.artistStatus ? String((me as any).artistStatus).toUpperCase() : "";
      const locked = status === "PENDING" || status === "REJECTED";

      const base = [
        { to: "/artist/dashboard", label: "Dashboard" },
        { to: "/artist/account", label: "Account" },
        { to: "/artist/analytics-summary", label: "Analytics" },
        { to: "/artist/channel-preview", label: "Channel Preview" },
        { to: "/artist/content-history", label: "Content History" }
      ];

      if (!locked) {
        base.splice(2, 0, { to: "/artist/pricing", label: "Pricing" });
        base.splice(5, 0, { to: "/artist/content-upload", label: "Content Upload" });
      }

      return base;
    },
    [me]
  );

  return (
    <div className="min-h-screen w-full bg-[#0a0808] text-white" style={backgroundStyle}>
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                className="md:hidden h-[36px] w-[36px] rounded-[10px] border border-white/10 bg-[#141010]/60 flex items-center justify-center text-[#e6d6d2]"
                onClick={() => {
                  setMobileNavOpen((v) => !v);
                  setMenuOpen(false);
                }}
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 7H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M4 12H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M4 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              <PremiumPlayLogo />

              <div className="hidden md:flex items-center gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`text-[13px] ${activePath.includes(item.to) ? "text-white" : "text-[#b8a6a1] hover:text-white"}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="relative z-[9999]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((v) => !v);
                  setMobileNavOpen(false);
                }}
                className="flex items-center gap-2 text-[13px] text-[#d8c7c3] hover:text-white"
              >
                <div className="h-[26px] w-[26px] rounded-full overflow-hidden border border-white/10 bg-[#141010]/70">
                  {profileSrc ? (
                    <img src={profileSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                  )}
                </div>
                <span className="max-w-[160px] truncate">{me?.name || me?.email || "Account"}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 z-[9999] mt-3 w-[200px] rounded-[6px] border border-white/10 bg-[#141010]/90 backdrop-blur px-2 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-[13px] text-[#d8c7c3] hover:bg-white/5 rounded-[4px]"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/artist/account");
                    }}
                  >
                    Account settings
                  </button>

                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-[13px] text-[#d8c7c3] hover:bg-white/5 rounded-[4px]"
                    onClick={() => {
                      localStorage.removeItem("artistToken");
                      navigate("/artist/login", { replace: true });
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {mobileNavOpen ? (
            <div className="md:hidden rounded-[10px] border border-white/10 bg-[#141010]/45 backdrop-blur shadow-[0_18px_40px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="px-3 py-2">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={`block px-3 py-2 rounded-[8px] text-[13px] ${activePath.includes(item.to) ? "bg-white/5 text-white" : "text-[#d8c7c3] hover:bg-white/5"}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 sm:mt-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
