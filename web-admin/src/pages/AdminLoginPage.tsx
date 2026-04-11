import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../services/http";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
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
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10.4 10.4C10.1 10.7 9.9 11.3 9.9 12C9.9 13.7 11.3 15.1 13 15.1C13.7 15.1 14.3 14.9 14.6 14.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6.5 6.5C4.3 8 2.8 10.5 2 12C2 12 5.5 19 12 19C13.8 19 15.4 18.5 16.8 17.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.3 5.3C10.1 5.1 11 5 12 5C18.5 5 22 12 22 12C22 12 20.8 14.8 18.6 16.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_3e012a.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await http.post("/api/v1/admin/login", {
        email,
        password
      });

      const token = res.data?.token as string | undefined;
      if (!token) {
        setError("Login failed");
        return;
      }

      localStorage.setItem("adminToken", token);
      navigate("/admin/home");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError("Forbidden");
      else setError(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0808]">
      <div
        className="absolute inset-0 grayscale opacity-40"
        style={backgroundStyle}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(#4b1927)_0%,rgba(75, 25, 39)_45%,
343, 50, 20_100%)]" />

      <div className="relative min-h-screen flex items-center justify-center px-6">
        {/* Login card with better visibility */}
        <div className="w-full max-w-[480px] bg-[#1a1414]/80 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10">
          <div className="flex flex-col items-center">
            <div className="mb-6">
              <img
                src="/logo.png"
                alt="Brand Logo"
                className="h-[100px] w-[100px] object-contain"
              />
            </div>

            <div className="mb-8 text-[32px] leading-[38px] font-light tracking-[2px] text-[#e8c4b8]">
              Admin Login
            </div>

            <form onSubmit={onSubmit} className="w-full">
              <div className="mb-2 text-[12px] uppercase tracking-widest text-[#a08078] font-medium">
                Email
              </div>
              <div className="mb-5">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  type="email"
                  className="w-full h-[50px] rounded-lg bg-[#241e1e]/90 border border-white/15 px-4 text-[15px] text-[#f0e0dc] placeholder:text-[#5a4a46] outline-none focus:border-[#b16e5b]/50 focus:bg-[#2a2424]/90 transition-all"
                  autoComplete="email"
                />
              </div>

              <div className="mb-2 text-[12px] uppercase tracking-widest text-[#a08078] font-medium">
                Password
              </div>
              <div className="mb-6 relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  type={showPassword ? "text" : "password"}
                  className="w-full h-[50px] rounded-lg bg-[#241e1e]/90 border border-white/15 pl-4 pr-12 text-[15px] text-[#f0e0dc] placeholder:text-[#5a4a46] outline-none focus:border-[#b16e5b]/50 focus:bg-[#2a2424]/90 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e5c59] hover:text-[#d3c2be]"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-lg text-[16px] font-medium text-white border border-[#b16e5b]/40 bg-gradient-to-r from-[#8b4a3a] to-[#6a352c] shadow-[0_4px_20px_rgba(139,74,58,0.3)] hover:from-[#9b5a4a] hover:to-[#7a453c] hover:shadow-[0_6px_25px_rgba(139,74,58,0.4)] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>

              <div className="h-5 mt-4 text-center text-[13px] tracking-wide text-[#ff8a8a] font-medium">
                {error ? error : ""}
              </div>

              <div className="mt-5 text-center text-[11px] uppercase tracking-[2px] text-[#6a5a56]">
                Authorized access only
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}