import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

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

export default function ArtistAccountInactivePage() {
  const navigate = useNavigate();

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.18) 0%, rgba(75,25,39,0.9) 55%, rgba(10,8,8,0.97) 100%)"
    } as const;
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#4b1927] text-white" style={backgroundStyle}>
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="w-full max-w-[720px] rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)] px-10 py-10">
          <div className="flex items-center gap-4">
            <PremiumPlayLogo />
            <div>
              <div className="text-[22px] font-light tracking-wide text-[#e6d6d2]">Account Inactive</div>
              <div className="mt-2 text-[13px] text-[#b8a6a1]">
                Your account is currently inactive. Please contact support for more details.
              </div>
            </div>
          </div>

          <div className="mt-6 text-[13px] text-[#cdbdb8] leading-6">
            While inactive, your profile and content are hidden from the Fan App.
          </div>

          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("artistToken");
                navigate("/artist/login", { replace: true });
              }}
              className="h-[42px] px-5 rounded-[7px] border border-white/10 bg-[#0e0a0a]/35 text-[14px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
            >
              Back to login
            </button>

            <Link
              to="/artist/login"
              className="text-[13px] text-[#a99792] hover:text-[#e6d6d2]"
              onClick={() => localStorage.removeItem("artistToken")}
            >
              Logout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
