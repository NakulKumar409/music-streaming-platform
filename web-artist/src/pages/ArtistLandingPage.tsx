import { useMemo } from "react";
import { Link } from "react-router-dom";

function PremiumPlayLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-[32px] w-[32px] rounded-full bg-gradient-to-b from-[#c97a54] to-[#7d4a41] p-[1px]">
        <div className="h-full w-full rounded-full bg-[#141010] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 7V17L16 12L9 7Z" fill="#c97a54" />
          </svg>
        </div>
      </div>
      <span className="text-[16px] font-semibold tracking-wide text-white">Artist Studio</span>
    </div>
  );
}

function TrustIndicator({ icon, text }: { icon: string, text: string }) {
  return (
    <div className="flex items-center gap-2 text-[#b8a6a1] text-sm font-medium">
      <span className="text-[#c97a54]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 relative">
      <div className="w-12 h-12 rounded-full bg-[#141010] border border-white/10 flex items-center justify-center text-lg font-bold text-[#c97a54] mb-4 shadow-[0_0_20px_rgba(201,122,84,0.15)]">
        {number}
      </div>
      <h4 className="text-lg font-medium text-white mb-2">{title}</h4>
      <p className="text-sm text-[#8d7b77] leading-relaxed">{description}</p>
    </div>
  );
}

export default function ArtistLandingPage() {
  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 50% 0%, rgba(201,122,84,0.15) 0%, rgba(30,18,18,0.8) 50%, rgba(10,8,8,1) 100%)"
    } as const;
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#141010] text-[#e6d6d2] overflow-x-hidden font-sans" style={backgroundStyle}>
      {/* 1. HEADER */}
      <header className="sticky top-0 z-50  border-b border-white/5 bg-[#141010]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <PremiumPlayLogo />
          <nav className="flex items-center gap-4">
            {/* Fan App Button — visible for listeners visiting the landing */}
            <a
              href="http://localhost:8081"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 h-[36px] px-4 rounded-full border border-[#c97a54]/30 bg-[#6a352c]/20 text-[13px] font-medium text-[#c97a54] hover:bg-[#6a352c]/35 hover:border-[#c97a54]/50 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="18" r="1" fill="currentColor" />
              </svg>
              Fan App
            </a>
            <Link 
              to="/artist/login"
              className="text-[14px] font-medium text-[#b8a6a1] hover:text-white transition-colors"
            >
              Log in
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
            Upload Your Music <br className="hidden md:block"/> to the World.
          </h1>
          
          <p className="text-xl md:text-2xl text-[#b8a6a1] font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Reach thousands of listeners instantly. Upload your songs, track real-time performance, and grow your independent fanbase with our premium artist tools.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-12">
            <Link
              to="/artist/signup"
              className="w-full sm:w-auto h-[56px] px-10 rounded-full border border-[#c97a54]/30 bg-gradient-to-b from-[#a3512e] to-[#7d3b20] flex items-center justify-center text-[16px] font-bold tracking-wide text-white shadow-[0_10px_30px_rgba(201,122,84,0.25)] hover:shadow-[0_15px_40px_rgba(201,122,84,0.4)] transition-all hover:-translate-y-1 whitespace-nowrap"
            >
              Create Artist Account
            </Link>
            <Link
              to="/artist/login"
              className="w-full sm:w-auto h-[56px] px-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[16px] font-bold tracking-wide text-white hover:bg-white/10 transition-all hover:-translate-y-1 whitespace-nowrap"
            >
              Log In
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 border-t border-white/5 pt-8 w-full max-w-3xl">
            <TrustIndicator icon="⚡" text="Fast Approval" />
            <TrustIndicator icon="🔒" text="Secure Uploads" />
            <TrustIndicator icon="📊" text="Real-Time Analytics" />
          </div>

          {/* Fan App Banner */}
          <div className="mt-10 w-full max-w-2xl rounded-[20px] border border-[#c97a54]/20 bg-[#6a352c]/10 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-[48px] w-[48px] rounded-[14px] bg-[#6a352c]/40 border border-[#c97a54]/20 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="2" width="14" height="20" rx="2" stroke="#c97a54" strokeWidth="1.6" />
                  <circle cx="12" cy="18" r="1" fill="#c97a54" />
                  <path d="M9 7H15" stroke="#c97a54" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M9 11H13" stroke="#c97a54" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-[14px] font-semibold text-white">Already a fan?</div>
                <div className="text-[12px] text-[#8d7b77] mt-0.5">Open the fan app to discover and stream music</div>
              </div>
            </div>
            <a
              href="http://localhost:8081"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 h-[42px] px-6 rounded-full border border-[#c97a54]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] flex items-center gap-2 text-[13px] font-semibold text-white hover:shadow-[0_8px_20px_rgba(106,53,44,0.4)] transition-all hover:-translate-y-0.5 whitespace-nowrap"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="18" r="1" fill="currentColor" />
              </svg>
              Open Fan App
            </a>
          </div>
        </div>
      </section>

      {/* 3. VALUE PROPOSITION SECTION */}
      <section className="py-20 px-6 bg-black/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need to succeed</h2>
            <p className="text-[#b8a6a1] max-w-2xl mx-auto">Our platform is built specifically for independent artists who want to focus on creating, not managing complex distribution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#1a1514] border border-white/5 p-8 rounded-[24px] hover:border-white/10 transition-colors group">
              <div className="h-14 w-14 bg-[#c97a54]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl">🎵</span>
              </div>
              <h3 className="text-xl text-white font-bold mb-3">Upload Effortlessly</h3>
              <p className="text-[15px] text-[#8d7b77] leading-relaxed">Skip the complicated distribution forms. Drag, drop, and publish your tracks directly to your listeners in minutes, not weeks.</p>
            </div>
            
            <div className="bg-[#1a1514] border border-white/5 p-8 rounded-[24px] hover:border-white/10 transition-colors group">
              <div className="h-14 w-14 bg-[#c97a54]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl text-white font-bold mb-3">Track Performance</h3>
              <p className="text-[15px] text-[#8d7b77] leading-relaxed">Understand your audience. See real-time analytics on who is streaming your music, where they live, and how your fanbase is growing.</p>
            </div>
            
            <div className="bg-[#1a1514] border border-white/5 p-8 rounded-[24px] hover:border-white/10 transition-colors group">
              <div className="h-14 w-14 bg-[#c97a54]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-xl text-white font-bold mb-3">Grow Your Audience</h3>
              <p className="text-[15px] text-[#8d7b77] leading-relaxed">Get discovered through algorithmic algorithmic playlists and user recommendations. Engage directly with fans who love your sound.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#c97a54]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
            <p className="text-[#b8a6a1] max-w-2xl mx-auto">From creating an account to hitting your first 1,000 streams.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StepCard number="1" title="Create Account" description="Sign up for free in 30 seconds. No credit card or complex contracts required." />
            <StepCard number="2" title="Upload Song" description="Upload your high-quality MP3 and stunning cover art through our simple interface." />
            <StepCard number="3" title="Get Approved" description="Our team quickly reviews your track to ensure high platform quality standards." />
            <StepCard number="4" title="Reach Listeners" description="Your track goes live globally. Watch your streams and subscriber count climb." />
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA SECTION */}
      <section className="py-24 px-6 bg-gradient-to-t from-[#141010] to-[#1e1412] border-t border-white/5 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Start your music journey today.</h2>
          <p className="text-xl text-[#b8a6a1] mb-10">Join thousands of artists already growing their careers on our platform.</p>
          <Link
            to="/artist/signup"
            className="inline-flex h-[60px] px-12 rounded-full border border-[#c97a54]/30 bg-gradient-to-b from-[#a3512e] to-[#7d3b20] items-center justify-center text-[18px] font-bold tracking-wide text-white shadow-[0_10px_30px_rgba(201,122,84,0.25)] hover:shadow-[0_15px_40px_rgba(201,122,84,0.4)] transition-all hover:-translate-y-1"
          >
            Create Artist Account
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-white/5 text-center text-[#8d7b77] text-sm">
        <p>© {new Date().getFullYear()} Artist Studio. All rights reserved.</p>
      </footer>
    </div>
  );
}
