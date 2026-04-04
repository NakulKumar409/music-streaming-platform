import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../services/http";

type OnboardResponse = {
  success: boolean;
  token?: string;
  pendingApproval?: boolean;
  message?: string;
};

const GENRES = [
  "Pop", "Hip-Hop", "Rock", "R&B", "Electronic", "Jazz", "Classical", "Country", "Indie", "Other"
];

function PremiumPlayLogo() {
  return (
    <div className="h-[40px] w-[40px] rounded-full bg-gradient-to-b from-[#c97a54] to-[#7d4a41] p-[1px]">
      <div className="h-full w-full rounded-full bg-[#141010] flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7V17L16 12L9 7Z" fill="#c97a54" />
        </svg>
      </div>
    </div>
  );
}

export default function ArtistSignupPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 50% 0%, rgba(201,122,84,0.15) 0%, rgba(30,18,18,0.8) 50%, rgba(10,8,8,1) 100%)"
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
        portfolioLinks: []
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to create account");
      }

      if (res.data?.token) {
        localStorage.setItem("artistToken", res.data.token);
      }

      setStep(3);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to submit application";
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
      headers: { "Content-Type": undefined as any }
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
          profileImageUrl
        });
      }
      setStep(4);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to complete profile";
      setError(msg);
      // Even if upload fails, we created the account. Let them pass to Step 4 so they aren't stuck.
      setStep(4);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#141010] text-[#e6d6d2] relative" style={backgroundStyle}>
      <Link
        to="/artist/landing"
        className="absolute top-6 left-6 text-[#b8a6a1] hover:text-[#e6d6d2] flex items-center gap-2 text-sm font-medium transition-colors z-50"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Landing Page
      </Link>
      
      <div className="min-h-screen w-full flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[500px]">
          
          {step < 4 && (
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <PremiumPlayLogo />
                <h1 className="text-2xl font-semibold text-white">Create Account</h1>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#8d7b77] mb-6">
                <span>Step {step} of 3</span>
                <div className="flex-1 h-1 bg-[#1a1514] rounded-full overflow-hidden ml-2">
                  <div 
                    className="h-full bg-gradient-to-r from-[#a3512e] to-[#c97a54] transition-all duration-300 ease-out"
                    style={{ width: `${(step / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-[16px] border border-white/5 bg-[#1a1514]/80 backdrop-blur-md shadow-2xl p-8 sm:p-10 relative overflow-hidden">
            {/* Busy Overlay */}
            {busy && (
              <div className="absolute inset-0 z-10 bg-[#1a1514]/80 backdrop-blur-sm flex items-center justify-center rounded-[16px]">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-[#c97a54]/30 border-t-[#c97a54] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-[#c97a54]">Processing...</p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-lg font-medium text-white mb-2">Account Details</h2>
                
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[48px] rounded-[10px] bg-[#141010] border border-white/10 px-4 text-[15px] text-white outline-none focus:border-[#c97a54]/50 transition-colors"
                    placeholder="artist@example.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-[48px] rounded-[10px] bg-[#141010] border border-white/10 px-4 text-[15px] text-white outline-none focus:border-[#c97a54]/50 transition-colors"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-[48px] rounded-[10px] bg-[#141010] border border-white/10 pl-4 pr-11 text-[15px] text-white outline-none focus:border-[#c97a54]/50 transition-colors"
                        placeholder="••••••••"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-[#b8a6a1] hover:text-[#e6d6d2] transition-colors"
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3L21 21" /><path d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4" /><path d="M9.9 5.1C10.6 4.9 11.3 4.8 12 4.8C18 4.8 21.5 12 21.5 12C20.7 13.6 19.6 15 18.3 16.2M6.8 6.8C4.2 8.7 2.5 12 2.5 12C2.5 12 4.2 15.3 6.8 17.2C8.3 18.3 10.1 19.2 12 19.2C12.9 19.2 13.8 19 14.6 18.7" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12C2.5 12 6 4.8 12 4.8C18 4.8 21.5 12 21.5 12C21.5 12 18 19.2 12 19.2C6 19.2 2.5 12 2.5 12Z" /><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full h-[48px] rounded-[10px] bg-[#141010] border pl-4 pr-11 text-[15px] text-white outline-none transition-colors ${confirmPassword && password !== confirmPassword ? 'border-red-500/50 focus:border-red-500/50' : 'border-white/10 focus:border-[#c97a54]/50'}`}
                        placeholder="••••••••"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-[#b8a6a1] hover:text-[#e6d6d2] transition-colors"
                      >
                        {showConfirmPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3L21 21" /><path d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4" /><path d="M9.9 5.1C10.6 4.9 11.3 4.8 12 4.8C18 4.8 21.5 12 21.5 12C20.7 13.6 19.6 15 18.3 16.2M6.8 6.8C4.2 8.7 2.5 12 2.5 12C2.5 12 4.2 15.3 6.8 17.2C8.3 18.3 10.1 19.2 12 19.2C12.9 19.2 13.8 19 14.6 18.7" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12C2.5 12 6 4.8 12 4.8C18 4.8 21.5 12 21.5 12C21.5 12 18 19.2 12 19.2C6 19.2 2.5 12 2.5 12Z" /><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-[8px]">{error}</div>}

                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full mt-4 h-[52px] rounded-[10px] bg-[#c97a54] text-[15px] font-bold tracking-wide text-[#141010] hover:bg-[#d98b65] transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-lg font-medium text-white mb-2">Artist Identity</h2>
                
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Artist / Stage Name</label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    className="w-full h-[48px] rounded-[10px] bg-[#141010] border border-white/10 px-4 text-[15px] text-white outline-none focus:border-[#c97a54]/50 transition-colors"
                    placeholder="e.g. The Midnight"
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-[#8d7b77]">This is how you will appear to fans globally.</p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Primary Genre</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full h-[48px] rounded-[10px] bg-[#141010] border border-white/10 px-4 text-[15px] text-white outline-none focus:border-[#c97a54]/50 transition-colors appearance-none"
                  >
                    <option value="" disabled>Select your main genre</option>
                    {GENRES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-[8px]">{error}</div>}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 h-[52px] rounded-[10px] border border-white/10 bg-white/5 text-[15px] font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleStep2Submit}
                    className="w-2/3 h-[52px] rounded-[10px] bg-[#c97a54] text-[15px] font-bold tracking-wide text-[#141010] hover:bg-[#d98b65] transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <h2 className="text-xl font-bold text-white">Account Created!</h2>
                  <p className="text-sm text-[#8d7b77] mt-1">Let's set up your public profile (Optional).</p>
                </div>

                <div className="flex flex-col items-center">
                  <div 
                    className="w-28 h-28 rounded-full border-2 border-dashed border-white/20 bg-[#141010] flex items-center justify-center cursor-pointer overflow-hidden group relative hover:border-[#c97a54]/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profilePreviewUrl ? (
                      <img src={profilePreviewUrl} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[#8d7b77] flex flex-col items-center">
                        <span className="text-2xl mb-1">📷</span>
                        <span className="text-[10px] uppercase font-medium tracking-wider">Upload</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-xs text-white font-medium">Change</span>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={e => setProfileFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8d7b77] mb-1">Short Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full h-24 p-4 rounded-[10px] bg-[#141010] border border-white/10 text-[14px] text-white outline-none focus:border-[#c97a54]/50 transition-colors resize-none"
                    placeholder="Tell your fans a bit about yourself..."
                  />
                </div>

                {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-[8px]">{error}</div>}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => handleStep3Complete()}
                    className="w-1/3 h-[52px] rounded-[10px] border border-white/10 bg-white/5 text-[15px] font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep3Complete()}
                    className="w-2/3 h-[52px] rounded-[10px] bg-[#c97a54] text-[15px] font-bold tracking-wide text-[#141010] hover:bg-[#d98b65] transition-colors"
                  >
                    Complete Profile
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center py-8 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-gradient-to-br from-[#c97a54] to-[#7d4a41] rounded-full mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(201,122,84,0.4)] mb-8">
                  <span className="text-4xl">🚀</span>
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-3">Your artist account is ready!</h2>
                <p className="text-[16px] text-[#b8a6a1] leading-relaxed mb-10 max-w-sm mx-auto">
                  You're officially part of the platform. The next step is getting your amazing music out to the world.
                </p>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate("/artist/content-upload", { replace: true })}
                    className="w-full h-[56px] rounded-[12px] bg-white text-[16px] font-bold tracking-wide text-[#141010] shadow-[0_4px_14px_rgba(255,255,255,0.25)] hover:bg-[#f0f0f0] transition-colors"
                  >
                    Upload First Song
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/artist/dashboard", { replace: true })}
                    className="w-full h-[56px] rounded-[12px] border border-white/10 bg-transparent text-[15px] font-medium tracking-wide text-[#e6d6d2] hover:bg-white/5 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
