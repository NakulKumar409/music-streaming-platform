import { useMemo } from "react";
import { Link } from "react-router-dom";

export default function ArtistDashboardPage() {
  const backgroundStyle = useMemo(() => ({
    backgroundImage:
      "radial-gradient(ellipse at 20% 0%, rgba(201,122,84,0.18) 0%, rgba(20,16,16,0.9) 50%, rgba(10,8,8,1) 100%)"
  } as const), []);

  const featureCards = [
    {
      icon: "🎵",
      title: "Upload Your First Song",
      desc: "Share your music with thousands of listeners. Upload audio or video tracks and go live instantly.",
      color: "from-[#c97a54]/20 to-transparent",
      border: "border-[#c97a54]/30",
      to: "/artist/content-upload"
    },
    {
      icon: "📈",
      title: "Track Your Growth",
      desc: "See detailed play counts, subscriber trends, and earnings breakdowns — all in one place.",
      color: "from-[#5468c9]/20 to-transparent",
      border: "border-[#5468c9]/30",
      to: "/artist/analytics-summary"
    },
    {
      icon: "💰",
      title: "Earn from Your Content",
      desc: "Set your own subscription price. Get paid directly every time a fan subscribes to your profile.",
      color: "from-[#54c97a]/20 to-transparent",
      border: "border-[#54c97a]/30",
      to: "/artist/analytics-summary"
    }
  ];

  const steps = [
    { num: "01", title: "Upload Your Song",  desc: "Add your audio or video track with cover art and description." },
    { num: "02", title: "Get Approved",      desc: "Our team reviews and approves your content within 24 hours." },
    { num: "03", title: "Reach Listeners",   desc: "Go live to thousands of active fans browsing for new music." },
    { num: "04", title: "Grow & Earn",       desc: "Build your subscriber base and start generating real income." }
  ];

  const previews = [
    { icon: "📊", label: "Your analytics will appear here", sub: "Plays, earnings & subscriber data" },
    { icon: "🎧", label: "Your songs will appear here",     sub: "All your uploaded tracks in one view" }
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden rounded-[16px] border border-white/5 bg-[#0e0a0a] shadow-2xl"
      style={backgroundStyle}
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-[#c97a54]/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[350px] w-[350px] rounded-full bg-[#5468c9]/[0.08] blur-[100px]" />

      <div className="relative px-5 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-14 flex flex-col gap-16">

        {/* ── 1. HERO ──────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c97a54]/30 bg-[#c97a54]/10 px-4 py-1.5 text-[13px] font-semibold text-[#c97a54] tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c97a54] animate-pulse" />
              Artist Studio
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
              Your Creative Space<br />
              <span className="bg-gradient-to-r from-[#c97a54] via-[#e6a070] to-[#c97a54] bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
                to Grow Your Music 🎧
              </span>
            </h1>
            <p className="text-[#a99792] text-lg leading-relaxed mb-8 max-w-lg">
              Upload tracks, build your subscriber base, and start earning — all from one powerful dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/artist/content-upload"
                className="group inline-flex h-[52px] items-center justify-center rounded-full bg-gradient-to-r from-[#c97a54] to-[#a65f3d] px-8 text-[15px] font-bold text-white shadow-[0_0_30px_rgba(201,122,84,0.4)] hover:shadow-[0_0_50px_rgba(201,122,84,0.6)] transition-all hover:-translate-y-1 animate-[pulse-glow_2.5s_ease-in-out_infinite]"
              >
                <span className="mr-2">🎵</span> Start Uploading Music
              </Link>
              <Link
                to="/artist/analytics-summary"
                className="inline-flex h-[52px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 text-[15px] font-semibold text-[#d8c7c3] hover:bg-white/10 hover:text-white transition-all"
              >
                View Analytics →
              </Link>
            </div>
          </div>

          {/* Decorative visual */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative h-[220px] w-[220px]">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#c97a54]/30 to-transparent" style={{ animation: "spin 12s linear infinite" }} />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#c97a54]/20 to-black/50 border border-[#c97a54]/20 flex items-center justify-center shadow-[0_0_60px_rgba(201,122,84,0.2)]">
                <span className="text-6xl drop-shadow-xl">🎵</span>
              </div>
              <div className="absolute -top-3 -right-3 h-14 w-14 rounded-full bg-[#c97a54]/20 border border-[#c97a54]/30 flex items-center justify-center text-2xl animate-bounce" style={{ animationDelay: "0.3s" }}>📈</div>
              <div className="absolute -bottom-3 -left-3 h-14 w-14 rounded-full bg-[#54c97a]/20 border border-[#54c97a]/30 flex items-center justify-center text-2xl animate-bounce" style={{ animationDelay: "0.8s" }}>💰</div>
            </div>
          </div>
        </div>

        {/* ── 2. EMPTY STATE CARD ──────────────────── */}
        <div className="relative overflow-hidden rounded-[20px] border border-[#c97a54]/25 bg-gradient-to-br from-[#c97a54]/10 via-black/30 to-[#141010] p-8 md:p-12 text-center shadow-[0_0_60px_rgba(201,122,84,0.1)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,122,84,0.15),transparent_70%)]" />
          <div className="relative">
            <div className="mb-6 mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-[#c97a54] to-[#7d4a41] flex items-center justify-center text-4xl shadow-[0_10px_40px_rgba(201,122,84,0.4)]">
              🎧
            </div>
            <h2 className="text-3xl font-black text-white mb-3">Your dashboard is ready 🎧</h2>
            <p className="text-[#a99792] text-lg max-w-lg mx-auto mb-8 leading-relaxed">
              Upload your first track to unlock analytics, earnings, and audience insights. Your journey starts with one song.
            </p>
            <Link
              to="/artist/content-upload"
              className="inline-flex h-[54px] items-center justify-center rounded-[14px] bg-white px-12 text-[16px] font-black text-[#141010] shadow-[0_10px_40px_rgba(255,255,255,0.15)] hover:scale-105 hover:shadow-[0_15px_50px_rgba(255,255,255,0.3)] transition-all"
            >
              Upload First Song →
            </Link>
          </div>
        </div>

        {/* ── 3. GUIDED FEATURE CARDS ──────────────── */}
        <div>
          <h2 className="text-2xl font-black text-white mb-2 text-center">Everything You Need to Succeed</h2>
          <p className="text-[#8d7b77] text-center mb-8">Powerful tools built for independent artists</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featureCards.map((card, i) => (
              <Link
                key={i}
                to={card.to}
                className={`group relative overflow-hidden rounded-[18px] border ${card.border} bg-gradient-to-br ${card.color} p-6 shadow-lg hover:-translate-y-2 transition-all duration-300 block`}
              >
                <div className="mb-4 h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
                <h3 className="text-white font-bold text-[17px] mb-2 group-hover:text-[#e6d6d2] transition-colors">{card.title}</h3>
                <p className="text-[#8d7b77] text-sm leading-relaxed group-hover:text-[#a99792] transition-colors">{card.desc}</p>
                <div className="absolute bottom-4 right-4 text-white/20 group-hover:text-white/60 transition-colors text-xl">→</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── 4. HOW IT WORKS ──────────────────────── */}
        <div className="rounded-[20px] border border-white/5 bg-black/30 p-8 md:p-10">
          <h2 className="text-2xl font-black text-white mb-2 text-center">How It Works</h2>
          <p className="text-[#8d7b77] text-center mb-10">Get from zero to live in 4 simple steps</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center group">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-[28px] left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-gradient-to-r from-[#c97a54]/40 to-transparent" />
                )}
                <div className="mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#c97a54]/30 to-black/50 border border-[#c97a54]/40 flex items-center justify-center font-black text-[#c97a54] text-lg shadow-[0_0_20px_rgba(201,122,84,0.2)] group-hover:shadow-[0_0_30px_rgba(201,122,84,0.4)] transition-all">
                  {step.num}
                </div>
                <h4 className="text-white font-bold text-[15px] mb-2">{step.title}</h4>
                <p className="text-[#8d7b77] text-xs leading-relaxed max-w-[160px]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. MOTIVATION SECTION ─────────────────── */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/5 bg-gradient-to-r from-[#1a1010] via-[#0e0a0a] to-[#101a1a] p-8 md:p-12 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,122,84,0.08),transparent_70%)]" />
          <div className="relative">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Start Your Journey Today
            </h2>
            <p className="text-[#a99792] text-[18px] max-w-lg mx-auto mb-8 leading-relaxed">
              Thousands of listeners are waiting for your music. Your next fan is just one upload away.
            </p>
            <Link
              to="/artist/content-upload"
              className="inline-flex h-[52px] items-center justify-center rounded-full bg-gradient-to-r from-[#c97a54] to-[#a65f3d] px-10 text-[15px] font-bold text-white shadow-[0_0_30px_rgba(201,122,84,0.35)] hover:shadow-[0_0_50px_rgba(201,122,84,0.6)] hover:-translate-y-1 transition-all"
            >
              🎵 Upload My First Song
            </Link>
          </div>
        </div>

        {/* ── 6. PREVIEW / FUTURE STATE ─────────────── */}
        <div>
          <h2 className="text-2xl font-black text-white mb-2">Coming Soon to Your Dashboard</h2>
          <p className="text-[#8d7b77] mb-8">This is what your dashboard will look like once you start uploading</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {previews.map((p, i) => (
              <div key={i} className="relative overflow-hidden rounded-[18px] border border-dashed border-white/10 bg-black/20 p-8 flex flex-col items-center text-center gap-3">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="h-3 w-3/4 mx-auto rounded-full bg-white/20 mt-6 mb-3" />
                  <div className="h-3 w-1/2 mx-auto rounded-full bg-white/10 mb-3" />
                  <div className="h-3 w-2/3 mx-auto rounded-full bg-white/10" />
                </div>
                <div className="relative z-10">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl mb-4">
                    {p.icon}
                  </div>
                  <h4 className="text-[#8d7b77] font-bold text-[16px] mb-1">{p.label}</h4>
                  <p className="text-[#8d7b77]/60 text-xs">{p.sub}</p>
                  <div className="mt-4 inline-flex items-center gap-1 text-[12px] text-[#c97a54]/60 font-medium border border-[#c97a54]/20 rounded-full px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c97a54]/40" />
                    Unlocks after first upload
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(201,122,84,0.4); }
          50% { box-shadow: 0 0 60px rgba(201,122,84,0.7); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
