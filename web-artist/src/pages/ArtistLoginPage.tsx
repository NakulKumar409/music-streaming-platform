import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";

type LoginResponse = {
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
    <div className="flex items-center gap-3">
      <div className="h-[44px] w-[44px] rounded-[14px] bg-gradient-to-b from-[#c97a54] to-[#7d4a41] p-[1.5px] shadow-[0_4px_20px_rgba(201,122,84,0.3)]">
        <div className="h-full w-full rounded-[12.5px] bg-[#141010] flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#c97a54" />
          </svg>
        </div>
      </div>
      <span className="text-xl font-bold tracking-wide text-white lg:hidden">Artist Studio</span>
    </div>
  );
}

export default function ArtistLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = localStorage.getItem("artistToken");
      if (!token) return;

      try {
        const meRes = await http.get<MeResponse>("/api/v1/artist/me");
        if (!mounted) return;
        const artistStatus = (meRes.data?.artist?.artistStatus ?? "").toString().toUpperCase();

        if (artistStatus === "APPROVED") {
          navigate("/artist/dashboard", { replace: true });
          return;
        }
        if (artistStatus === "PENDING") {
          navigate("/artist/under-review", { replace: true });
          return;
        }
        if (artistStatus === "REJECTED") {
          navigate("/artist/rejected", { replace: true });
          return;
        }
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) {
          const msg = (e?.response?.data?.message ?? "").toString().toLowerCase();
          if (msg.includes("inactive") || msg.includes("suspended")) {
            localStorage.removeItem("artistToken");
            navigate("/artist/account-inactive", { replace: true });
            return;
          }
        }

        if (status === 401 || status === 403) {
          localStorage.removeItem("artistToken");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await http.post<LoginResponse>("/api/v1/auth/login", {
        email,
        password
      });

      if (!res.data?.success) {
        setError(res.data?.message || "Login failed");
        return;
      }

      const token = res.data?.token;
      if (token) localStorage.setItem("artistToken", token);

      const role = (res.data.user?.role || "").toString().toUpperCase();
      const status = (res.data.user?.status || "").toString().toUpperCase();
      const isVerified = Boolean(res.data.user?.isVerified);

      if (role !== "ARTIST") {
        localStorage.removeItem("artistToken");
        setError("Only artist accounts can log in here.");
        return;
      }

       if (status === "SUSPENDED") {
         localStorage.removeItem("artistToken");
         setError("Your artist account has been suspended. Please contact support.");
         return;
       }

      if (status !== "ACTIVE") {
        localStorage.removeItem("artistToken");
        setError("Your artist account is not active. Please contact support.");
        return;
      }

      try {
        const meRes = await http.get<MeResponse>("/api/v1/artist/me");
        const artistStatus = (meRes.data?.artist?.artistStatus ?? "").toString().toUpperCase();
        if (artistStatus === "APPROVED") {
          navigate("/artist/dashboard", { replace: true });
          return;
        }
        if (artistStatus === "PENDING") {
          navigate("/artist/under-review", { replace: true });
          return;
        }
        if (artistStatus === "REJECTED") {
          navigate("/artist/rejected", { replace: true });
          return;
        }
      } catch {
        // ignore; fall back to legacy logic
      }

      if (!isVerified || res.data?.pendingApproval) {
        navigate("/artist/under-review", { replace: true });
        return;
      }

      navigate("/artist/dashboard", { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Login failed";
      const status = e?.response?.status;
      if (status === 403) {
        const lower = String(msg).toLowerCase();
        if (lower.includes("inactive") || lower.includes("suspended")) {
          localStorage.removeItem("artistToken");
          navigate("/artist/account-inactive", { replace: true });
          return;
        }
      }

      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0e0a0a] text-white selection:bg-[#c97a54]/30 overflow-hidden font-sans">
      
      {/* LEFT PANEL: Branding & Visuals (Hidden on small screens) */}
      <div className="hidden lg:flex w-[45%] relative items-center justify-center p-12 border-r border-[#ffffff0a]">
        {/* Immersive mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#c97a54]/15 via-[#4b1927]/30 to-[#0e0a0a]" />
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[80%] bg-[#b16e5b]/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#c97a54]/15 blur-[100px] rounded-full pointer-events-none" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 w-full max-w-md">
          <Link
            to="/artist/landing"
            className="inline-flex items-center gap-2 text-[#b8a6a1] hover:text-[#e6d6d2] text-sm font-medium transition-colors group mb-16"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:-translate-x-1">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Website
          </Link>
          
          <div className="mb-10">
            <PremiumPlayLogo />
            <div className="mt-4 text-xl font-bold tracking-wide text-white">Artist Studio</div>
          </div>
          
          <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Welcome back to your stage.
          </h1>
          <p className="text-[#a99792] text-lg font-light leading-relaxed max-w-sm">
            Access your artist dashboard, track your performance, and keep growing your independent fanbase.
          </p>
          
          {/* Decorative stats */}
          <div className="grid grid-cols-2 gap-6 mt-16 pt-12 border-t border-white/5 opacity-80">
            <div>
              <div className="text-3xl font-bold text-[#e6d6d2]">2M+</div>
              <div className="text-sm text-[#b8a6a1] mt-1">Listeners Reached</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#c97a54]">$15M</div>
              <div className="text-sm text-[#b8a6a1] mt-1">Paid to Artists</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Login Form */}
      <div className="flex-1 flex flex-col justify-center relative p-6 sm:p-12 lg:p-24 overflow-y-auto">
        {/* Mobile Background Fallback */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-tr from-[#1e1311] via-[#140e0d] to-[#0e0a0a]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#c97a54]/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-[420px] mx-auto relative z-10 transition-all">
          
          {/* Mobile Back Button & Logo */}
          <div className="lg:hidden flex flex-col gap-10 mb-10">
            <Link
              to="/artist/landing"
              className="inline-flex items-center gap-2 text-[#b8a6a1] hover:text-[#e6d6d2] text-sm font-medium transition-colors group self-start"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:-translate-x-1">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Landing Page
            </Link>
            <div className="self-center">
              <PremiumPlayLogo />
            </div>
          </div>

          <div className="text-center lg:text-left mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-3">Log in to Artist Studio</h2>
            <p className="text-[#a99792] text-[15px]">Enter your credentials to access your dashboard.</p>
          </div>
          
          <form 
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className="space-y-6 bg-black/20 p-8 rounded-[20px] border border-white/5 backdrop-blur-xl shadow-2xl"
          >
            <div>
              <label className="block text-[13px] font-medium text-[#b8a6a1] mb-2">Email Address</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[50px] rounded-[10px] bg-white/5 border border-white/10 px-4 text-[15px] text-[#e6d6d2] outline-none hover:border-white/20 focus:border-[#c97a54]/50 focus:ring-2 focus:ring-[#c97a54]/20 transition-all placeholder:text-[#b8a6a1]/50"
                placeholder="artist@example.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#b8a6a1] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[50px] rounded-[10px] bg-white/5 border border-white/10 pl-4 pr-12 text-[15px] text-[#e6d6d2] outline-none hover:border-white/20 focus:border-[#c97a54]/50 focus:ring-2 focus:ring-[#c97a54]/20 transition-all placeholder:text-[#b8a6a1]/50"
                  placeholder="••••••"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg flex items-center justify-center text-[#b8a6a1] hover:text-[#e6d6d2] hover:bg-white/10 focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-[52px] mt-2 rounded-[12px] bg-gradient-to-b from-[#b16e5b] to-[#8c4836] text-[16px] font-bold tracking-wide text-white shadow-[0_8px_20px_rgba(201,122,84,0.25)] hover:shadow-[0_12px_25px_rgba(201,122,84,0.35)] hover:-translate-y-[1px] active:translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_20px_rgba(201,122,84,0.25)] transition-all"
            >
              {busy ? "Authenticating..." : "Log In"}
            </button>
          </form>

          <div className="mt-8 text-center text-[14px] text-[#a99792]">
            Don't have an artist account?{" "}
            <Link to="/artist/signup" className="text-[#c97a54] font-medium hover:text-[#e6d6d2] transition-colors">
              Apply now
            </Link>
          </div>

          <div className="mt-8 text-center">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-[13px] text-white/30 hover:text-white/60 transition-colors"
            >
              Contact Support
            </a>
          </div>
          
        </div>
      </div>
    </div>
  );
}
