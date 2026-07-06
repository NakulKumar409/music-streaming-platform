import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Upload,
  Music2,
  User,
  Mail,
  Phone,
  Lock,
  Sparkles,
  Shield,
  DollarSign,
} from "lucide-react";

type OnboardResponse = {
  success: boolean;
  token?: string;
  pendingApproval?: boolean;
  message?: string;
};

const GENRES = [
  "Pop",
  "Hip-Hop",
  "Rock",
  "R&B",
  "Electronic",
  "Jazz",
  "Classical",
  "Country",
  "Indie",
  "Other",
];

function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-full" />
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

export default function ArtistSignupPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Account Setup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Artist Identity
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");

  // Step 3: Profile Setup
  const [bio, setBio] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Revenue Share Plan Selection
  const [selectedCommissionPlans, setSelectedCommissionPlans] = useState<number[]>([]);
  const [commissionPlans, setCommissionPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Step 5: Terms & Conditions
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState("");
  const [termsVersion, setTermsVersion] = useState("");
  const [loadingTerms, setLoadingTerms] = useState(false);

  // Step 6: Digital Signature
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 50% 0%, rgba(201,122,84,0.15) 0%, rgba(30,18,18,0.8) 50%, rgba(10,8,8,1) 100%)",
    } as const;
  }, []);

  const profilePreviewUrl = useMemo(() => {
    if (!profileFile) return null;
    return URL.createObjectURL(profileFile);
  }, [profileFile]);

  useEffect(() => {
    return () => {
      if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl);
    };
  }, [profilePreviewUrl]);

  // Fetch commission plans when entering Step 4
  useEffect(() => {
    if (step === 4) {
      fetchCommissionPlans();
    }
  }, [step]);

  // Fetch terms content when entering Step 5
  useEffect(() => {
    if (step === 5) {
      fetchTermsContent();
    }
  }, [step]);

  const fetchCommissionPlans = async () => {
    setLoadingPlans(true);
    try {
      const res = await http.get("/api/v1/artist/commission-plans");
      if (res.data?.success) {
        setCommissionPlans(res.data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch revenue share plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchTermsContent = async () => {
    setLoadingTerms(true);
    try {
      const res = await http.get("/api/v1/artist/terms/current");
      if (res.data?.success) {
        setTermsContent(res.data.terms.content);
        setTermsVersion(res.data.terms.version);
      }
    } catch (error) {
      console.error('Failed to fetch terms content:', error);
      // Fallback to default terms if API fails
      setTermsContent("Default terms and conditions will be loaded here.");
      setTermsVersion("v1");
    } finally {
      setLoadingTerms(false);
    }
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleStep1Next = () => {
    setError(null);
    if (!email.trim() || !password || !confirmPassword || !phone.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setStep(2);
  };

  const handleStep2Submit = async () => {
    setError(null);
    if (!artistName.trim() || !genre) {
      setError("Please fill in your artist name and select a primary genre.");
      return;
    }

    setBusy(true);
    try {
      const res = await http.post<OnboardResponse>("/api/v1/artist/onboard", {
        email: email.trim(),
        password,
        artistName: artistName.trim(),
        phone: phone.trim(),
        genre,
        bio: "",
        portfolioLinks: [],
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to create account");
      }

      if (res.data?.token) {
        localStorage.setItem("artistToken", res.data.token);
      }

      setStep(3);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to submit application";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const uploadProfileImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("kind", "profile");
    const r = await http.post("/api/v1/artist/uploads/image", fd, {
      headers: { "Content-Type": undefined as any },
    });
    if (!r.data?.success) throw new Error(r.data?.message || "Upload failed");
    return r.data.url;
  };

  const handleStep3Complete = async () => {
    setBusy(true);
    setError(null);
    try {
      let profileImageUrl = null;
      if (profileFile) {
        profileImageUrl = await uploadProfileImage(profileFile);
      }

      if (bio.trim() || profileImageUrl) {
        await http.patch("/api/v1/artist/me", {
          bio: bio.trim(),
          profileImageUrl,
        });
      }
      setStep(4);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to complete profile";
      setError(msg);
      // Even if upload fails, we created the account. Let them pass to Step 4 so they aren't stuck.
      setStep(4);
    } finally {
      setBusy(false);
    }
  };

  const handleStep4Next = () => {
    setError(null);
    if (selectedCommissionPlans.length === 0) {
      setError("Please select a revenue share plan to continue.");
      return;
    }
    setStep(5);
  };

  const handleStep5Next = () => {
    setError(null);
    if (!termsAccepted) {
      setError("Please accept the terms and conditions to continue.");
      return;
    }
    setStep(6);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.strokeStyle = "#1E3A8A"; // Blue ink color like a ballpoint pen
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
        setSignatureData(canvas.toDataURL());
      }
    }
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      if (ctx && e.touches[0]) {
        ctx.beginPath();
        ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
      }
    }
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      if (ctx && e.touches[0]) {
        ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        ctx.strokeStyle = "#1E3A8A"; // Blue ink color
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
        setSignatureData(canvas.toDataURL());
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleStep6Next = () => {
    setError(null);
    if (!signatureData) {
      setError("Please provide your signature to continue.");
      return;
    }
    setStep(7);
  };

  const handleStep7Submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await http.post("/api/v1/artist/onboard", {
        email: email.trim(),
        password,
        artistName: artistName.trim(),
        phone: phone.trim(),
        genre,
        bio: bio.trim(),
        portfolioLinks: [],
        agreementAccepted: true,
        agreementVersion: "v1",
        commissionPlanIds: selectedCommissionPlans,
        digitalSignature: signatureData,
        termsVersion: termsVersion,
      });

      setStep(8);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to submit agreement";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-white overflow-hidden font-sans relative">
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
          background: linear-gradient(135deg, var(--color-primary) 0%, #f06d3c 25%, var(--color-secondary) 50%, var(--color-primary) 75%, #f06d3c 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient 4s ease infinite;
        }
      `}</style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-[50%] left-[50%] w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-500" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-primary/10 animate-float font-playfair"
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

      <Link
        to="/artist/landing"
        className="absolute top-4 sm:top-6 left-4 sm:left-6 text-[#8d7b77] hover:text-[#e6d6d2] flex items-center gap-2 text-sm font-inter font-medium transition-all group z-50 hover:gap-3">
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to Landing Page
      </Link>

      <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16">
        <div className="w-full max-w-[500px] relative z-10">
          {step < 8 && (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <BrandLogo />
              </div>
              <div className="flex items-center gap-2 text-sm font-inter text-[#8d7b77]">
                <span>Step {step} of 7</span>
                <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden ml-2">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-out"
                    style={{ width: `${(step / 7) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-secondary/10 to-primary/20 blur-2xl rounded-3xl animate-pulse" />

            <div className="relative glass-effect rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/5 rounded-full blur-2xl" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />

              {busy && (
                <div className="absolute inset-0 z-10 bg-[#1a1210]/80 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-inter font-medium text-primary">
                      Processing...
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Create Account
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Start your journey as an artist
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                      Email Address
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a4a46] group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 pl-10 pr-4 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:border-primary/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20"
                        placeholder="artist@example.com"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                      Mobile Number
                    </label>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a4a46] group-focus-within:text-primary transition-colors" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 pl-10 pr-4 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:border-primary/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                        Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a4a46] group-focus-within:text-primary transition-colors" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 pl-10 pr-10 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:border-primary/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20"
                          placeholder="••••••••"
                          autoCapitalize="none"
                          autoCorrect="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-[#8d7b77] hover:text-[#e6d6d2] hover:bg-white/10 transition-all duration-300">
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                        Confirm Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a4a46] group-focus-within:text-primary transition-colors" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border pl-10 pr-10 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20 ${
                            confirmPassword && password !== confirmPassword
                              ? "border-red-500/50 focus:border-red-500/50"
                              : "border-white/10 focus:border-primary/50 focus:bg-[#1a1210]/80"
                          }`}
                          placeholder="••••••••"
                          autoCapitalize="none"
                          autoCorrect="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-[#8d7b77] hover:text-[#e6d6d2] hover:bg-white/10 transition-all duration-300">
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStep1Next}
                    className="relative w-full h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300 mt-2">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Continue
                    </span>
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Artist Identity
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Tell us about your artist persona
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                      Artist / Stage Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a4a46] group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 pl-10 pr-4 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 placeholder:text-[#5a4a46] focus:border-primary/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20"
                        placeholder="e.g. The Midnight"
                        autoFocus
                      />
                    </div>
                    <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs font-inter text-[#5a4a46]">
                      This is how you will appear to fans globally.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                      Primary Genre
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full h-[46px] sm:h-[50px] rounded-xl bg-[#1a1210]/60 border border-white/10 px-4 text-[14px] sm:text-[15px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 focus:border-primary/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20 appearance-none">
                      <option value="" disabled className="text-[#5a4a46]">
                        Select your main genre
                      </option>
                      {GENRES.map((g) => (
                        <option
                          key={g}
                          value={g}
                          className="text-white bg-[#1a1210]">
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full sm:w-1/3 h-[48px] sm:h-[52px] rounded-xl border border-white/10 bg-white/5 text-[14px] sm:text-[15px] font-inter font-medium text-white hover:bg-white/10 transition-all duration-300">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleStep2Submit}
                      className="relative w-full sm:w-2/3 h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Create Account
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mb-3">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Account Created!
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Let's set up your public profile (Optional)
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <div
                      className="relative w-28 h-28 rounded-full border-2 border-dashed border-white/20 bg-[#1a1210]/60 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-primary/50 transition-all duration-300"
                      onClick={() => fileInputRef.current?.click()}>
                      {profilePreviewUrl ? (
                        <img
                          src={profilePreviewUrl}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[#8d7b77] flex flex-col items-center">
                          <Upload className="w-8 h-8 mb-1" />
                          <span className="text-[10px] font-inter font-medium uppercase tracking-wider">
                            Upload
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                        <span className="text-xs font-inter font-medium text-white">
                          Change
                        </span>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={(e) =>
                        setProfileFile(e.target.files?.[0] || null)
                      }
                    />
                    <p className="text-[11px] font-inter text-[#5a4a46] mt-3">
                      Upload a profile picture (optional)
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] sm:text-[12px] uppercase tracking-wider text-[#8d7b77] font-inter font-medium mb-1.5 sm:mb-2">
                      Short Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full h-24 p-4 rounded-xl bg-[#1a1210]/60 border border-white/10 text-[14px] font-inter text-[#f0e0dc] outline-none transition-all duration-300 focus:border-primary/50 focus:bg-[#1a1210]/80 focus:shadow-[0_0_30px_rgba(232,93,44,0.05)] hover:border-white/20 resize-none"
                      placeholder="Tell your fans a bit about yourself..."
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleStep3Complete()}
                      className="w-full sm:w-1/3 h-[48px] sm:h-[52px] rounded-xl border border-white/10 bg-white/5 text-[14px] sm:text-[15px] font-inter font-medium text-white hover:bg-white/10 transition-all duration-300">
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStep3Complete()}
                      className="relative w-full sm:w-2/3 h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Complete Profile
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 text-primary mb-3">
                      <DollarSign className="w-7 h-7" />
                    </div>
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Revenue Share Plan
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Choose the plan that best fits your music strategy
                    </p>
                  </div>

                  {loadingPlans ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-[#8d7b77]">Loading revenue share plans...</p>
                    </div>
                  ) : commissionPlans.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-[#8d7b77]">No revenue share plans available. Please contact support.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[390px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
                      {commissionPlans.map((plan) => {
                        const isSelected = selectedCommissionPlans.includes(plan.id);
                        return (
                          <div
                            key={plan.id}
                            onClick={() => setSelectedCommissionPlans([plan.id])}
                            className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden group/card ${
                              isSelected
                                ? 'bg-gradient-to-br from-primary/15 to-secondary/5 border-primary shadow-[0_0_25px_rgba(232,93,44,0.15)] scale-[1.02]'
                                : 'bg-[#140e0c]/60 border-white/5 hover:border-white/20 hover:bg-[#1c1411]/80 hover:scale-[1.01]'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              {/* Custom Radio Button Indicator */}
                              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                                isSelected ? 'border-primary' : 'border-white/30 group-hover/card:border-white/50'
                              }`}>
                                <div className={`w-2.5 h-2.5 rounded-full bg-primary transition-all duration-300 ${
                                  isSelected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                                }`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                                  <h3 className="text-[15px] font-bold text-white tracking-wide font-outfit">
                                    {plan.name || `Plan ${plan.version}`}
                                  </h3>
                                  <span className="text-[10px] uppercase tracking-wider font-semibold font-inter px-2 py-0.5 rounded bg-white/5 text-[#8d7b77] border border-white/5">
                                    v{plan.version || 1}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-3.5">
                                  <div className="text-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5 group-hover/card:bg-white/[0.04] transition-colors">
                                    <div className="text-2xl font-black text-primary font-outfit tracking-tight">
                                      {plan.artistShare}%
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#8d7b77] font-inter">
                                      Artist Share
                                    </div>
                                  </div>
                                  <div className="text-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5 group-hover/card:bg-white/[0.04] transition-colors">
                                    <div className="text-2xl font-black text-secondary font-outfit tracking-tight">
                                      {plan.platformShare}%
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#8d7b77] font-inter">
                                      Platform Share
                                    </div>
                                  </div>
                                </div>

                                {plan.description && (
                                  <p className="text-[12px] text-[#8d7b77] font-inter leading-relaxed mb-3">
                                    {plan.description}
                                  </p>
                                )}

                                {plan.benefits && plan.benefits.length > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#8d7b77] font-inter">
                                      Benefits & Terms
                                    </p>
                                    <ul className="grid grid-cols-1 gap-1.5">
                                      {plan.benefits.map((benefit: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-[#8d7b77] font-inter">
                                          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                          <span>{benefit}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedCommissionPlans.length > 0 && (() => {
                    const selectedPlan = commissionPlans.find(p => p.id === selectedCommissionPlans[0]);
                    return selectedPlan ? (
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 animate-in fade-in duration-300">
                        <p className="text-sm text-[#e8c4b8] font-inter flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span>Selected: <span className="font-semibold text-white">{selectedPlan.name || `Plan ${selectedPlan.version}`}</span></span>
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[11px] text-[#8d7b77] font-inter leading-relaxed">
                      Your selected revenue share plan will be fixed for your signed agreement. Future platform changes will not affect your existing agreement.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStep4Next}
                    disabled={selectedCommissionPlans.length === 0 || loadingPlans}
                    className="relative w-full h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Continue
                    </span>
                  </button>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 mb-3">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Terms & Conditions
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Please review and accept our terms
                    </p>
                  </div>

                  {loadingTerms ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-[#8d7b77]">Loading terms...</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-xl bg-[#1a1210]/60 border border-white/10 max-h-[300px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-white">Artist Agreement Terms</h3>
                          <span className="text-xs text-[#8d7b77] bg-white/5 px-2 py-1 rounded">Version {termsVersion}</span>
                        </div>
                        <div className="text-xs text-[#8d7b77] leading-relaxed whitespace-pre-wrap">
                          {termsContent || "Terms content will be loaded here."}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="terms-checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0"
                        />
                        <label htmlFor="terms-checkbox" className="text-sm text-[#8d7b77] cursor-pointer">
                          I have read and agree to the Terms & Conditions
                        </label>
                      </div>
                    </>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="w-full sm:w-1/3 h-[48px] sm:h-[52px] rounded-xl border border-white/10 bg-white/5 text-[14px] sm:text-[15px] font-inter font-medium text-white hover:bg-white/10 transition-all duration-300">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleStep5Next}
                      disabled={loadingTerms}
                      className="relative w-full sm:w-2/3 h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Next
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-purple-500/20 text-purple-400 mb-3">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Digital Signature
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Please sign below to complete the agreement
                    </p>
                  </div>

                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      width={450}
                      height={150}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawingTouch}
                      onTouchMove={drawTouch}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[150px] rounded-xl bg-[#fdfaf2] border border-[#e8c4b8]/30 cursor-crosshair shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/10 text-xs text-[#8d7b77] hover:bg-white/20 transition-all">
                      Clear
                    </button>
                  </div>

                  <p className="text-xs text-[#5a4a46] text-center">
                    Draw your signature using your mouse or touch screen
                  </p>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="w-full sm:w-1/3 h-[48px] sm:h-[52px] rounded-xl border border-white/10 bg-white/5 text-[14px] sm:text-[15px] font-inter font-medium text-white hover:bg-white/10 transition-all duration-300">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleStep6Next}
                      className="relative w-full sm:w-2/3 h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Next
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {step === 7 && (
                <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mb-3">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#e8c4b8]">
                      Review & Submit
                    </h2>
                    <p className="font-inter text-[#8d7b77] text-[13px] sm:text-[14px] mt-1">
                      Please review your agreement details
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    <div className="p-4 rounded-xl bg-[#1a1210]/60 border border-white/10">
                      <h3 className="text-xs font-semibold text-[#8d7b77] uppercase tracking-wider mb-3">Artist Information</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#8d7b77]">Name:</span>
                          <span className="text-white">{artistName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8d7b77]">Email:</span>
                          <span className="text-white">{email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8d7b77]">Phone:</span>
                          <span className="text-white">{phone || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8d7b77]">Genre:</span>
                          <span className="text-white">{genre}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#1a1210]/60 border border-white/10">
                      <h3 className="text-xs font-semibold text-[#8d7b77] uppercase tracking-wider mb-3">
                        Revenue Share Plan
                      </h3>
                      {selectedCommissionPlans.length > 0 && commissionPlans.length > 0 ? (
                        <div className="space-y-4">
                          {selectedCommissionPlans.map(id => {
                            const plan = commissionPlans.find(p => p.id === id);
                            if (!plan) return null;
                            return (
                              <div key={plan.id} className="space-y-2 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                <div className="flex justify-between items-center">
                                  <span className="text-white font-medium">{plan.name || `Plan ${plan.version}`}</span>
                                  <span className="text-xs text-[#8d7b77]">v{plan.version || 1}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="text-center p-2.5 rounded-lg bg-white/5">
                                    <div className="text-xl font-bold text-primary">{plan.artistShare}%</div>
                                    <div className="text-xs text-[#8d7b77]">Artist Share</div>
                                  </div>
                                  <div className="text-center p-2.5 rounded-lg bg-white/5">
                                    <div className="text-xl font-bold text-secondary">{plan.platformShare}%</div>
                                    <div className="text-xs text-[#8d7b77]">Platform Share</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-[#8d7b77]">No plans selected</p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-[#1a1210]/60 border border-white/10">
                      <h3 className="text-xs font-semibold text-[#8d7b77] uppercase tracking-wider mb-3">Agreement Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#8d7b77]">Version:</span>
                          <span className="text-white">{termsVersion || "v1"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8d7b77]">Terms Accepted:</span>
                          <span className="text-emerald-400">Yes</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#1a1210]/60 border border-white/10">
                      <h3 className="text-xs font-semibold text-[#8d7b77] uppercase tracking-wider mb-3">Signature</h3>
                      {signatureData && (
                        <img
                          src={signatureData}
                          alt="Signature preview"
                          className="h-[80px] w-full object-contain bg-white/5 rounded-lg"
                        />
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] sm:text-[13px] font-inter backdrop-blur-sm animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(6)}
                      className="w-full sm:w-1/3 h-[48px] sm:h-[52px] rounded-xl border border-white/10 bg-white/5 text-[14px] sm:text-[15px] font-inter font-medium text-white hover:bg-white/10 transition-all duration-300">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleStep7Submit}
                      className="relative w-full sm:w-2/3 h-[48px] sm:h-[52px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Submit Agreement
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {step === 8 && (
                <div className="text-center py-6 sm:py-8 animate-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(232,93,44,0.4)] mb-6 sm:mb-8">
                    <Music2 className="w-12 h-12 text-white" />
                  </div>

                  <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-[#e8c4b8] mb-3">
                    Your artist account is ready!
                  </h2>
                  <p className="text-[15px] sm:text-[16px] font-inter text-[#8d7b77] leading-relaxed mb-8 sm:mb-10 max-w-sm mx-auto">
                    You're officially part of the platform. The next step is
                    getting your amazing music out to the world.
                  </p>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/artist/content-upload", { replace: true })
                      }
                      className="relative w-full h-[52px] sm:h-[56px] rounded-xl text-[15px] sm:text-[16px] font-inter font-semibold text-white overflow-hidden group transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#f06d3c] to-secondary bg-[length:200%_100%] group-hover:bg-[length:100%_100%] transition-all duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="absolute inset-0 rounded-xl shadow-[0_4px_20px_rgba(232,93,44,0.3)] group-hover:shadow-[0_8px_30px_rgba(232,93,44,0.5)] transition-all duration-300" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Music2 className="w-4 h-4" />
                        Upload First Song
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/artist/dashboard", { replace: true })
                      }
                      className="w-full h-[52px] sm:h-[56px] rounded-xl border border-white/10 bg-white/5 text-[14px] sm:text-[15px] font-inter font-medium text-white hover:bg-white/10 transition-all duration-300">
                      Go to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}