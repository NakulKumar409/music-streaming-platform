import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  Users,
  DollarSign,
  Music2,
  Sparkles,
  CheckCircle2,
  Shield,
  Crown,
  TrendingUp,
  Radio,
  Headphones,
  LogIn,
  Zap,
} from "lucide-react";

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

function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 bg-[#e85d2c]/30 blur-2xl rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#e85d2c]/20 to-transparent rounded-full" />
        <img
          src="/logo.png"
          alt="Brand Logo"
          className="h-[40px] w-[40px] sm:h-[44px] sm:w-[44px] object-contain relative z-10"
        />
      </div>
      <span className="text-lg sm:text-xl font-['Playfair_Display'] font-bold tracking-wide bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        Artist Studio
      </span>
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
        const artistStatus = (meRes.data?.artist?.artistStatus ?? "")
          .toString()
          .toUpperCase();

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
          const msg = (e?.response?.data?.message ?? "")
            .toString()
            .toLowerCase();
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
        password,
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
        setError(
          "Your artist account has been suspended. Please contact support."
        );
        return;
      }

      if (status !== "ACTIVE") {
        localStorage.removeItem("artistToken");
        setError("Your artist account is not active. Please contact support.");
        return;
      }

      try {
        const meRes = await http.get<MeResponse>("/api/v1/artist/me");
        const artistStatus = (meRes.data?.artist?.artistStatus ?? "")
          .toString()
          .toUpperCase();
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
    <div className="min-h-screen w-full flex bg-[#080505] text-white overflow-hidden font-sans relative">
      {/* Google Fonts Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,700&family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        .font-playfair {
          font-family: 'Playfair Display', serif;
        }
        .font-outfit {
          font-family: 'Outfit', sans-serif;
        }
        .font-inter {
          font-family: 'Inter', sans-serif;
        }
        
        @keyframes wave {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 0.3; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animate-shimmer {
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .animate-pulse-ring {
          animation: pulse-ring 3s ease-in-out infinite;
        }
        .glass-effect {
          background: rgba(15, 9, 8, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .text-gradient-gold {
          background: linear-gradient(135deg, #e85d2c 0%, #f06d3c 25%, #c97a54 50%, #e85d2c 75%, #f06d3c 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient 4s ease infinite;
        }
        .text-gradient-white {
          background: linear-gradient(135deg, #ffffff 0%, #b8a6a1 50%, #ffffff 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient 3s ease infinite;
        }
      `}</style>

      {/* Ambient Background Music Visualizer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-[#e85d2c]/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-[#c97a54]/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-[50%] left-[50%] w-96 h-96 bg-[#e85d2c]/5 rounded-full blur-3xl animate-pulse delay-500" />
        </div>
        {/* Floating music notes */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute text-[#e85d2c]/10 animate-float font-playfair"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${i * 0.5}s`,
              fontSize: `${20 + Math.random() * 30}px`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}>
            ♪
          </div>
        ))}
      </div>

      {/* LEFT PANEL - Premium Typography Design */}
      <div className="hidden lg:flex w-[50%] relative items-center justify-center p-8 xl:p-12 border-r border-white/5">
        {/* Premium Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a08] via-[#0a0707] to-[#080505]" />

        {/* Decorative Elements */}
        <div className="absolute top-10 left-10 w-32 h-32 border border-[#e85d2c]/10 rounded-full animate-pulse-ring" />
        <div className="absolute bottom-10 right-10 w-24 h-24 border border-[#e85d2c]/10 rounded-full animate-pulse-ring delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-[#e85d2c]/5 rounded-full animate-pulse-ring delay-500" />

        {/* Music Wave Animation */}
        <div className="absolute bottom-20 left-10 flex items-end gap-1 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-[#e85d2c] rounded-full"
              style={{
                height: `${10 + Math.random() * 40}px`,
                animation: `wave ${
                  1 + Math.random() * 2
                }s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-md">
          {/* Back Button */}
          <Link
            to="/artist/landing"
            className="inline-flex items-center gap-2 text-[#8d7b77] hover:text-[#e6d6d2] text-sm font-inter font-medium transition-all group mb-12 xl:mb-16 hover:gap-3">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Website
          </Link>

          {/* Brand */}
          <div className="mb-8 xl:mb-10">
            <BrandLogo />
          </div>

          {/* Main Heading - Premium Font */}
          <div className="relative">
            <div className="absolute -top-4 -left-4 text-7xl font-playfair font-bold text-[#e85d2c]/5 select-none">
              ✦
            </div>
            <h1 className="font-playfair text-4xl xl:text-5xl font-bold tracking-tight mb-4 xl:mb-6 leading-tight">
              <span className="text-white/90">Welcome back to</span>
              <br />
              <span className="relative inline-block">
                <span className="text-gradient-gold font-playfair italic">
                  your stage.
                </span>
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-[#e85d2c] to-transparent" />
              </span>
            </h1>
          </div>

          <p className="text-[#a99792] text-base xl:text-lg font-outfit font-light leading-relaxed max-w-sm">
            Access your artist dashboard, track your performance, and grow your
            independent fanbase.
          </p>

          {/* Feature Chips */}
          <div className="flex flex-wrap gap-2 mt-6 xl:mt-8">
            {["Analytics", "Uploads", "Global Reach", "Royalties"].map(
              (tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 text-xs font-inter font-medium bg-[#e85d2c]/10 border border-[#e85d2c]/20 rounded-full text-[#e8a87c] hover:bg-[#e85d2c]/20 transition-all cursor-default">
                  {tag}
                </span>
              )
            )}
          </div>

          {/* Stats with Premium Design */}
          <div className="grid grid-cols-2 gap-4 xl:gap-6 mt-8 xl:mt-10 pt-8 xl:pt-10 border-t border-white/5">
            <div className="group relative overflow-hidden bg-gradient-to-br from-[#1a0a08] to-transparent p-4 rounded-2xl border border-white/5 hover:border-[#e85d2c]/30 transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 bg-[#e85d2c]/0 group-hover:bg-[#e85d2c]/5 transition-all duration-500" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#e85d2c]/10 rounded-xl group-hover:bg-[#e85d2c]/20 transition-all duration-300">
                  <Users className="w-5 h-5 text-[#e85d2c]" />
                </div>
                <div>
                  <div className="text-2xl xl:text-3xl font-playfair font-bold text-[#e6d6d2]">
                    2M+
                  </div>
                  <div className="text-xs xl:text-sm font-inter text-[#8d7b77] mt-0.5">
                    Listeners
                  </div>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden bg-gradient-to-br from-[#1a0a08] to-transparent p-4 rounded-2xl border border-white/5 hover:border-[#e85d2c]/30 transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 bg-[#e85d2c]/0 group-hover:bg-[#e85d2c]/5 transition-all duration-500" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#e85d2c]/10 rounded-xl group-hover:bg-[#e85d2c]/20 transition-all duration-300">
                  <DollarSign className="w-5 h-5 text-[#e85d2c]" />
                </div>
                <div>
                  <div className="text-2xl xl:text-3xl font-playfair font-bold text-[#e85d2c]">
                    $15M
                  </div>
                  <div className="text-xs xl:text-sm font-inter text-[#8d7b77] mt-0.5">
                    Paid Out
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badge */}
          <div className="flex items-center gap-2 mt-6 text-[11px] font-inter text-[#5a4a46]">
            <Shield className="w-3 h-3" />
            <span>Secure • Encrypted • Trusted by 10K+ artists</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Premium Login */}
      <div className="flex-1 flex flex-col justify-center relative p-4 sm:p-8 lg:p-12 xl:p-16 overflow-y-auto">
        {/* Mobile Background */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-tr from-[#1a0a08] via-[#0a0707] to-[#080505]" />

        {/* Decorative Orbs */}
        <div className="absolute top-0 right-0 w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] bg-[#e85d2c]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-[#c97a54]/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-[400px] mx-auto relative z-10">
          {/* Mobile Header */}
          <div className="lg:hidden flex flex-col gap-6 sm:gap-8 mb-6 sm:mb-8">
            <Link
              to="/artist/landing"
              className="inline-flex items-center gap-2 text-[#8d7b77] hover:text-[#e6d6d2] text-sm font-inter font-medium transition-all group self-start hover:gap-3">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Landing Page
            </Link>
            <div className="self-center">
              <BrandLogo />
            </div>
          </div>

          {/* Login Card - Premium Design */}
          <div className="relative">
            {/* Card Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#e85d2c]/20 via-[#c97a54]/10 to-[#e85d2c]/20 blur-2xl rounded-3xl animate-pulse" />

            <div className="relative glass-effect rounded-2xl p-6 sm:p-8 shadow-2xl">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#e85d2c]/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#c97a54]/5 rounded-full blur-2xl" />

              {/* Top Gradient Line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-gradient-to-r from-transparent via-[#e85d2c] to-transparent rounded-full" />

              {/* Logo & Title */}
              <div className="text-center mb-6 sm:mb-8">
                {/* Logo - Now visible on all screens */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#e85d2c]/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative p-2 bg-gradient-to-br from-[#1a0a08] to-[#0a0707] rounded-2xl border border-white/10">
                      <img
                        src="/logo.png"
                        alt="Brand Logo"
                        className="h-[56px] w-[56px] sm:h-[64px] sm:w-[64px] object-contain"
                      />
                    </div>
                  </div>
                </div>
                <h2 className="font-playfair text-2xl sm:text-[28px] font-bold tracking-tight text-[#e8c4b8]">
                  Welcome Back
                </h2>
                <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                  Sign in to your artist dashboard
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
                className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                    Email Address
                  </label>
                  <div className="relative group">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 px-3 sm:px-4 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:border-[#e85d2c]/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20"
                      placeholder="artist@example.com"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#e85d2c]/0 via-[#e85d2c]/0 to-[#e85d2c]/0 group-focus-within:from-[#e85d2c]/5 group-focus-within:via-[#e85d2c]/0 group-focus-within:to-[#e85d2c]/5 pointer-events-none transition-all duration-500" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                    <label className="text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium">
                      Password
                    </label>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="text-[11px] font-inter text-[#8d7b77] hover:text-[#e85d2c] transition-colors">
                      Forgot?
                    </a>
                  </div>
                  <div className="relative group">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 pl-3 sm:pl-4 pr-10 sm:pr-12 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:border-[#e85d2c]/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20"
                      placeholder="••••••"
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-[#8d7b77] hover:text-[#e6d6d2] hover:bg-white/10 focus:outline-none transition-all duration-300">
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="relative w-full h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300">
                  {/* Button Background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#e85d2c] via-[#f06d3c] to-[#c97a54] bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />

                  {/* Button Shine */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                  {/* Button Glow */}
                  <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />

                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {busy ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Sign In
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* Footer Links */}
              <div className="mt-6 sm:mt-8 text-center">
                <p className="text-[13px] sm:text-[14px] font-inter text-[#8d7b77]">
                  New here?{" "}
                  <Link
                    to="/artist/signup"
                    className="text-[#e85d2c] font-medium hover:text-[#f06d3c] transition-colors relative inline-block group">
                    Create Account
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#e85d2c] to-[#c97a54] group-hover:w-full transition-all duration-300" />
                  </Link>
                </p>
              </div>

              <div className="mt-4 flex items-center justify-center gap-4">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[11px] font-inter text-[#5a4a46] hover:text-[#8d7b77] transition-colors flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Support
                </a>
                <span className="w-px h-3 bg-white/5" />
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[11px] font-inter text-[#5a4a46] hover:text-[#8d7b77] transition-colors">
                  Privacy
                </a>
                <span className="w-px h-3 bg-white/5" />
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[11px] font-inter text-[#5a4a46] hover:text-[#8d7b77] transition-colors">
                  Terms
                </a>
              </div>
            </div>
          </div>

          {/* Mobile Stats */}
          <div className="lg:hidden mt-6 grid grid-cols-2 gap-3">
            <div className="bg-[#1a1210]/50 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5 hover:border-[#e85d2c]/20 transition-all">
              <Headphones className="w-4 h-4 text-[#e85d2c] mx-auto mb-1" />
              <div className="text-xs font-inter text-[#8d7b77]">
                2M+ Listeners
              </div>
            </div>
            <div className="bg-[#1a1210]/50 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5 hover:border-[#e85d2c]/20 transition-all">
              <TrendingUp className="w-4 h-4 text-[#e85d2c] mx-auto mb-1" />
              <div className="text-xs font-inter text-[#8d7b77]">$15M Paid</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
