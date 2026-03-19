import { useEffect, useMemo, useState } from "react";
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
    <div className="h-[48px] w-[48px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-[#1a1414]/80 border border-white/10 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
        </svg>
      </div>
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
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#4b1927] text-white" style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="w-full max-w-[520px]">
          <div className="flex items-center justify-center mb-10">
            <PremiumPlayLogo />
          </div>

          <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)] px-10 py-10">
            <div className="space-y-6">
              <div>
                <div className="text-[13px] text-[#b8a6a1]">Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full h-[44px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="artist@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="text-[13px] text-[#b8a6a1]">Password</div>
                <div className="relative mt-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[44px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 pl-4 pr-11 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                    placeholder="••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-[6px] flex items-center justify-center text-[#b8a6a1] hover:text-[#e6d6d2] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3 3L21 21"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9.9 5.1C10.6 4.9 11.3 4.8 12 4.8C18 4.8 21.5 12 21.5 12C20.7 13.6 19.6 15 18.3 16.2M6.8 6.8C4.2 8.7 2.5 12 2.5 12C2.5 12 4.2 15.3 6.8 17.2C8.3 18.3 10.1 19.2 12 19.2C12.9 19.2 13.8 19 14.6 18.7"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2.5 12C2.5 12 6 4.8 12 4.8C18 4.8 21.5 12 21.5 12C21.5 12 18 19.2 12 19.2C6 19.2 2.5 12 2.5 12Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="text-[13px] text-[#e3a1a1]">{error}</div>
              ) : null}

              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className="h-[46px] w-full rounded-[7px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[15px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
              >
                {busy ? "Logging in..." : "Log in"}
              </button>

              <div className="pt-1 text-[13px] text-[#a99792]">
                Don&apos;t have an artist account?{" "}
                <Link to="/artist/signup" className="text-[#e6d6d2] hover:underline">
                  Register here
                </Link>
              </div>

              <div className="text-center">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[13px] text-[#a99792] hover:text-[#e6d6d2]"
                >
                  Contact support ›
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
