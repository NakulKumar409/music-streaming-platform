import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Zap,
  BarChart3,
  CloudUpload,
  ShieldCheck,
  Users,
  Globe,
  Music2,
  ArrowRight,
  Play,
  Star,
  ChevronDown,
  Menu,
  X,
  Mic,
  ArrowUpRight,
  TrendingUp,
  Radio,
  UserPlus,
} from "lucide-react";

export default function ArtistLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const backgroundStyle = useMemo(
    () => ({
      backgroundColor: "#080A0B",
      backgroundImage: `
        radial-gradient(circle at 75% 15%, rgba(255, 118, 43, 0.12) 0%, transparent 45%),
        radial-gradient(circle at 20% 50%, rgba(255, 118, 43, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 80% 85%, rgba(255, 170, 87, 0.06) 0%, transparent 45%),
        linear-gradient(to bottom, #080A0B 0%, #0E1113 50%, #080A0B 100%)
      `,
    }),
    []
  );

  const faqs = [
    {
      q: "How does the music review and approval process work?",
      a: "Once you submit your track and cover artwork, our curation team verifies audio standards, loudness compliance, and metadata within 24-48 hours. You receive immediate status updates via your artist dashboard.",
    },
    {
      q: "What audio and artwork formats are supported?",
      a: "We support lossless WAV and FLAC (16-bit or 24-bit, 44.1kHz+) as well as 320kbps MP3. Cover artwork must be a square image (minimum 3000x3000px, JPG or PNG format).",
    },
    {
      q: "How do fans discover and stream my music?",
      a: "Approved releases are instantly delivered to listeners on the web and mobile Fan App. Live stream metrics, listener locations, and playlist adds appear directly in your real-time analytics.",
    },
    {
      q: "Is there any upfront fee or credit card required to join?",
      a: "No. Creating your Artist Studio account and completing onboarding is 100% free with no credit card required.",
    },
  ];

  return (
    <div
      className="min-h-screen w-full text-[#F5F5F4] overflow-x-hidden selection:bg-[#FF762B]/30 selection:text-white"
      style={{
        ...backgroundStyle,
        fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}>
      {/* Subtle background audio grid lines */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ─── NAVBAR ─── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080A0B]/85 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            to="/artist/landing"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF762B] rounded-lg p-1"
            aria-label="Artist Studio Home">
            <img
              src="/logo.png"
              alt="Artist Studio Logo"
              className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-[0_2px_12px_rgba(255,118,43,0.35)] transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-[17px] sm:text-[19px] font-semibold tracking-tight text-[#F5F5F4]">
              Artist Studio
            </span>
          </Link>

          {/* Desktop Nav Links (Visible on lg+) */}
          <nav
            className="hidden lg:flex items-center gap-7 xl:gap-8"
            aria-label="Main Navigation">
            <a
              href="#features"
              className="text-[14px] font-medium text-[#B6B8BA] hover:text-[#F5F5F4] transition-colors">
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-[14px] font-medium text-[#B6B8BA] hover:text-[#F5F5F4] transition-colors">
              How It Works
            </a>
            <a
              href="#analytics"
              className="text-[14px] font-medium text-[#B6B8BA] hover:text-[#F5F5F4] transition-colors">
              Analytics
            </a>
            <a
              href="#success-stories"
              className="text-[14px] font-medium text-[#B6B8BA] hover:text-[#F5F5F4] transition-colors">
              Success Stories
            </a>
            <a
              href="#faq"
              className="text-[14px] font-medium text-[#B6B8BA] hover:text-[#F5F5F4] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Nav Actions (Desktop lg+) */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="http://localhost:8081"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-9 px-4 rounded-full border border-[#FF762B]/35 bg-[#FF762B]/10 text-[13px] font-medium text-[#FFAA57] hover:bg-[#FF762B]/20 hover:border-[#FF762B]/50 transition-all">
              <Smartphone className="w-3.5 h-3.5 text-[#FF762B]" />
              Fan App
            </a>
            <Link
              to="/artist/login"
              className="text-[14px] font-medium text-[#B6B8BA] hover:text-white px-2 py-1 transition-colors">
              Log in
            </Link>
          </div>

          {/* Mobile & Tablet Toggle Button (< lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href="http://localhost:8081"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full border border-[#FF762B]/35 bg-[#FF762B]/10 text-[12px] font-medium text-[#FFAA57] hover:bg-[#FF762B]/20">
              <Smartphone className="w-3.5 h-3.5 text-[#FF762B]" />
              Fan App
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#B6B8BA] hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF762B]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu">
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-white/[0.08] bg-[#0E1113]/98 px-5 py-6 space-y-4 shadow-2xl backdrop-blur-xl">
              <nav className="flex flex-col space-y-3">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[15px] font-medium text-[#B6B8BA] hover:text-white py-1 transition-colors">
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[15px] font-medium text-[#B6B8BA] hover:text-white py-1 transition-colors">
                  How It Works
                </a>
                <a
                  href="#analytics"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[15px] font-medium text-[#B6B8BA] hover:text-white py-1 transition-colors">
                  Analytics
                </a>
                <a
                  href="#success-stories"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[15px] font-medium text-[#B6B8BA] hover:text-white py-1 transition-colors">
                  Success Stories
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[15px] font-medium text-[#B6B8BA] hover:text-white py-1 transition-colors">
                  FAQ
                </a>
              </nav>

              <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-3">
                <a
                  href="http://localhost:8081"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-full border border-[#FF762B]/35 bg-[#FF762B]/10 text-[14px] font-medium text-[#FFAA57] flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#FF762B]" />
                  Open Fan App
                </a>
                <Link
                  to="/artist/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full h-11 rounded-full border border-white/10 bg-[#181C1F] text-[14px] font-medium text-white flex items-center justify-center">
                  Log In
                </Link>
                <Link
                  to="/artist/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full h-11 rounded-full bg-gradient-to-r from-[#FF762B] to-[#E55A13] text-[14px] font-medium text-white flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,118,43,0.3)]">
                  Create Artist Account <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* ─── 1. HERO SECTION ─── */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-8 sm:pt-16 pb-14 sm:pb-24 overflow-hidden">
          {/* Ambient Lighting Glow behind Hero */}
          <div className="absolute top-1/4 right-1/4 w-[380px] sm:w-[600px] h-[380px] sm:h-[600px] bg-[#FF762B]/12 blur-[120px] rounded-full pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Column: Hero Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 text-left">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#FF762B]/30 bg-[#FF762B]/10 mb-4 sm:mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF762B] animate-pulse" />
                <span className="text-[11px] sm:text-[12px] font-semibold tracking-wider text-[#FF762B] uppercase">
                  For Independent Artists
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-[58px] xl:text-[64px] font-semibold tracking-tight text-[#F5F5F4] leading-[1.08] mb-4 sm:mb-5">
                Music has <br />
                <span className="text-[#FF762B] bg-gradient-to-r from-[#FF762B] via-[#FFAA57] to-[#FF762B] bg-clip-text text-transparent">
                  no boundaries.
                </span>
              </h1>

              {/* Subheading */}
              <p className="text-[15px] sm:text-[17px] text-[#B6B8BA] max-w-lg leading-relaxed mb-7 sm:mb-8">
                Upload your tracks, reach real listeners, and turn your passion
                into a global music career.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 mb-7 sm:mb-10">
                <Link
                  to="/artist/signup"
                  className="h-12 sm:h-13 px-7 sm:px-8 rounded-full bg-gradient-to-r from-[#FF762B] to-[#E55A13] hover:from-[#FF8238] hover:to-[#EB661F] text-white font-medium text-[15px] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,118,43,0.32)] hover:shadow-[0_12px_32px_rgba(255,118,43,0.45)] hover:-translate-y-0.5 transition-all">
                  Create Artist Account
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </Link>
                <Link
                  to="/artist/login"
                  className="h-12 sm:h-13 px-7 sm:px-8 rounded-full bg-[#181C1F] hover:bg-[#202529] border border-white/10 hover:border-white/20 text-[#F5F5F4] font-medium text-[15px] flex items-center justify-center transition-all">
                  Log In
                </Link>
              </div>

              {/* Trust Indicator */}
              <div className="flex items-center gap-3.5 pt-4 border-t border-white/[0.08]">
                <div className="flex -space-x-2.5">
                  <img
                    src="/avatar-rohan.jpg"
                    alt="Artist Rohan"
                    className="w-8 h-8 rounded-full border-2 border-[#080A0B] object-cover"
                  />
                  <img
                    src="/avatar-priya.jpg"
                    alt="Artist Priya"
                    className="w-8 h-8 rounded-full border-2 border-[#080A0B] object-cover"
                  />
                  <img
                    src="/avatar-aman.jpg"
                    alt="Artist Aman"
                    className="w-8 h-8 rounded-full border-2 border-[#080A0B] object-cover"
                  />
                </div>
                <p className="text-[12px] sm:text-[13px] text-[#85898D]">
                  <span className="font-semibold text-[#FFAA57]">10K+</span>{" "}
                  artists already growing with Artist Studio.
                </p>
              </div>
            </motion.div>

            {/* Right Column: Cinematic Music Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="lg:col-span-6 relative flex items-center justify-center mt-2 sm:mt-0">
              {/* Concentric ambient soundwave rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[300px] sm:w-[480px] h-[300px] sm:h-[480px] rounded-full border border-[#FF762B]/10 animate-pulse" />
                <div className="w-[230px] sm:w-[380px] h-[230px] sm:h-[380px] rounded-full border border-[#FF762B]/15" />
                <div className="w-[170px] sm:w-[280px] h-[170px] sm:h-[280px] rounded-full border border-[#FFAA57]/20" />
                <div className="w-[280px] sm:w-[420px] h-[280px] sm:h-[420px] rounded-full bg-[#FF762B]/15 blur-[90px]" />
              </div>

              {/* Central Cinematic Visual Wrapper */}
              <div className="relative w-full max-w-[440px] sm:max-w-[460px] aspect-[4/4] sm:aspect-[4/3.8] rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] bg-[#121618]">
                {/* Fallback & Primary Artist Image */}
                <img
                  src="/hero-artist.jpg"
                  alt="Cinematic Artist Playing Guitar"
                  className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />

                {/* Vignette gradient overlay for smooth integration */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080A0B] via-transparent to-black/30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080A0B]/40 via-transparent to-transparent pointer-events-none" />

                {/* Floating handwritten cursive accent: "Create Share Grow" */}
                <div className="absolute top-3 right-4 sm:top-6 sm:right-6 pointer-events-none select-none">
                  <span
                    className="text-[#FFAA57] text-base sm:text-2xl font-serif italic drop-shadow-[0_2px_12px_rgba(255,118,43,0.6)]"
                    style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}>
                    Create
                    <br />
                    <span className="ml-3">Share</span>
                    <br />
                    <span className="ml-6">Grow</span>
                  </span>
                </div>

                {/* Floating Play Button */}
                <div className="absolute top-[48%] left-[45%] -translate-x-1/2 -translate-y-1/2">
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#FF762B]/90 hover:bg-[#FF762B] text-white flex items-center justify-center shadow-[0_0_30px_rgba(255,118,43,0.7)] backdrop-blur-md transition-transform hover:scale-110 cursor-pointer">
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
                  </div>
                </div>


                {/* Floating "Your music. Everywhere." Audience Pill */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 rounded-full bg-[#181C1F]/90 backdrop-blur-md border border-white/10 px-3 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2.5 sm:gap-3 shadow-2xl">
                  <div className="text-[11px] sm:text-[12px] font-medium text-white whitespace-nowrap">
                    Your music.{" "}
                    <span className="text-[#FFAA57]">Everywhere.</span>
                  </div>
                  <div className="flex -space-x-1.5 items-center">
                    <img
                      src="/avatar-rohan.jpg"
                      alt="Listener"
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-black object-cover"
                    />
                    <img
                      src="/avatar-priya.jpg"
                      alt="Listener"
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-black object-cover"
                    />
                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#FF762B] bg-[#FF762B]/15 px-1 py-0.5 rounded-full ml-1 border border-[#FF762B]/20">
                      +8M
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── 2. FOUR FEATURE CARDS ─── */}
        <section
          id="features"
          className="px-4 sm:px-6 lg:px-8 py-8 sm:py-16 scroll-mt-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {[
                {
                  title: "Upload Music",
                  desc: "Upload your tracks, albums and artwork in minutes.",
                  icon: CloudUpload,
                },
                {
                  title: "Track Performance",
                  desc: "Real-time analytics to understand your audience.",
                  icon: BarChart3,
                },
                {
                  title: "Get Approved",
                  desc: "Our team reviews your music to ensure top quality.",
                  icon: ShieldCheck,
                },
                {
                  title: "Reach Listeners",
                  desc: "Go live globally and grow your fanbase.",
                  icon: Users,
                },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group relative rounded-2xl bg-[#121618] border border-white/[0.08] hover:border-[#FF762B]/35 p-4 sm:p-6 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(255,118,43,0.12)] hover:-translate-y-0.5">
                  {/* Mobile Row Layout (< sm) */}
                  <div className="flex sm:hidden items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#181C1F] border border-white/[0.08] flex items-center justify-center text-[#FF762B] shrink-0">
                        <f.icon className="w-5 h-5 text-[#FF762B]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-white truncate">
                          {f.title}
                        </h3>
                        <p className="text-[12px] text-[#B6B8BA] truncate">
                          {f.desc}
                        </p>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/[0.04] text-[#85898D] flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Tablet & Desktop Card Layout (sm+) */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-[#181C1F] border border-white/[0.08] group-hover:border-[#FF762B]/30 flex items-center justify-center text-[#FF762B] group-hover:scale-110 transition-all duration-300">
                        <f.icon className="w-5 h-5 text-[#FF762B]" />
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/[0.03] group-hover:bg-[#FF762B]/15 text-[#85898D] group-hover:text-[#FFAA57] flex items-center justify-center transition-colors">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <h3 className="text-[17px] font-semibold text-white mb-2 group-hover:text-[#FFAA57] transition-colors">
                      {f.title}
                    </h3>
                    <p className="text-[13px] text-[#B6B8BA] leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 3. ARTIST ANALYTICS PREVIEW SECTION ─── */}
        <section
          id="analytics"
          className="px-4 sm:px-6 lg:px-8 py-14 sm:py-24 bg-[#0E1113]/50 border-y border-white/[0.06] scroll-mt-20">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-5 text-left">
              <div className="inline-block text-[11px] sm:text-[12px] font-semibold tracking-wider text-[#FF762B] uppercase mb-3">
                Real Results For Real Artists
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-semibold text-[#F5F5F4] tracking-tight leading-[1.12] mb-4">
                Data that <br />
                <span className="text-[#FF762B]">drives your growth.</span>
              </h2>
              <p className="text-[15px] sm:text-[16px] text-[#B6B8BA] leading-relaxed mb-7 sm:mb-8 max-w-md">
                Understand your audience, track your performance, and make
                smarter decisions with powerful analytics.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
                <Link
                  to="/artist/signup"
                  className="h-12 px-7 rounded-full bg-gradient-to-r from-[#FF762B] to-[#E55A13] hover:from-[#FF8238] hover:to-[#EB661F] text-white font-medium text-[14px] flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(255,118,43,0.3)] hover:-translate-y-0.5 transition-all">
                  Create Artist Account
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </Link>
                <a
                  href="#features"
                  className="h-12 px-6 rounded-full border border-white/10 hover:border-white/20 text-[#B6B8BA] hover:text-white font-medium text-[14px] flex items-center justify-center gap-1.5 transition-colors">
                  Learn More
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right: Dashboard Mock Preview */}
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl sm:rounded-3xl bg-[#121618] border border-white/[0.09] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
                  {/* Dashboard Sidebar (Visible on md+) */}
                  <div className="hidden md:flex md:col-span-4 flex-col justify-between p-4 sm:p-5 border-r border-white/[0.08] bg-[#0E1113]">
                    <div className="space-y-4">
                      {/* Brand Header */}
                      <div className="flex items-center gap-2.5 px-2 py-1">
                        <img
                          src="/logo.png"
                          alt="Brand"
                          className="w-5 h-5 object-contain"
                        />
                        <span className="text-[13px] font-semibold text-white">
                          Artist Studio
                        </span>
                      </div>

                      {/* Nav Links */}
                      <nav className="space-y-1">
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FF762B]/15 border border-[#FF762B]/25 text-[#FFAA57] text-[13px] font-medium">
                          <BarChart3 className="w-4 h-4 text-[#FF762B]" />
                          Dashboard
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#85898D] hover:text-white hover:bg-white/5 text-[13px] font-medium transition-colors">
                          <Music2 className="w-4 h-4" />
                          My Music
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#85898D] hover:text-white hover:bg-white/5 text-[13px] font-medium transition-colors">
                          <TrendingUp className="w-4 h-4" />
                          Analytics
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#85898D] hover:text-white hover:bg-white/5 text-[13px] font-medium transition-colors">
                          <Users className="w-4 h-4" />
                          Audience
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#85898D] hover:text-white hover:bg-white/5 text-[13px] font-medium transition-colors">
                          <Zap className="w-4 h-4" />
                          Earnings
                        </div>
                      </nav>
                    </div>

                    {/* Artist Profile bottom */}
                    <div className="flex items-center gap-2.5 pt-4 border-t border-white/[0.08] px-2">
                      <img
                        src="/avatar-rohan.jpg"
                        alt="Alex Carter"
                        className="w-8 h-8 rounded-full border border-white/20 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white truncate">
                          Alex Carter
                        </div>
                        <div className="text-[10px] text-[#85898D] truncate">
                          Independent Artist
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Analytics Content */}
                  <div className="md:col-span-8 p-4 sm:p-6 flex flex-col justify-between">
                    <div>
                      {/* Overview Header & Filter */}
                      <div className="flex items-center justify-between mb-4 sm:mb-5 pb-3 border-b border-white/[0.06]">
                        <div className="text-[15px] sm:text-[16px] font-semibold text-white">
                          Overview
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] sm:text-[12px] text-[#B6B8BA]">
                          <span>Last 30 days</span>
                          <ChevronDown className="w-3 h-3 text-[#85898D]" />
                        </div>
                      </div>

                      {/* Metrics 4-Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
                        {[
                          {
                            label: "Streams",
                            val: "125.4K",
                            growth: "+12.5%",
                          },
                          {
                            label: "Listeners",
                            val: "8.2K",
                            growth: "+9.8%",
                          },
                          {
                            label: "Countries",
                            val: "45",
                            growth: "+6.1%",
                          },
                          {
                            label: "Downloads",
                            val: "2.1K",
                            growth: "+7.4%",
                          },
                        ].map((m) => (
                          <div
                            key={m.label}
                            className="rounded-xl bg-[#181C1F] border border-white/[0.06] p-2.5 sm:p-3">
                            <div className="text-[11px] text-[#85898D] mb-1">
                              {m.label}
                            </div>
                            <div className="text-[15px] sm:text-[17px] font-semibold text-white">
                              {m.val}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium mt-1">
                              <span>↑</span>
                              <span>{m.growth}</span>
                            </div>
                            {/* Mini sparkline */}
                            <div className="h-3 w-full mt-1.5">
                              <svg
                                viewBox="0 0 60 16"
                                className="w-full h-full">
                                <polyline
                                  points="0,12 12,9 24,11 36,5 48,7 60,2"
                                  fill="none"
                                  stroke="#34d399"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Top Tracks Breakdown */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[13px] font-semibold text-white">
                            Top Tracks
                          </span>
                          <span className="text-[11px] text-[#FF762B] hover:underline cursor-pointer">
                            View all →
                          </span>
                        </div>
                        <div className="space-y-2">
                          {[
                            {
                              rank: "1",
                              name: "Midnight Drive",
                              streams: "3.2K",
                              percent: 85,
                            },
                            {
                              rank: "2",
                              name: "Sunset Dreams",
                              streams: "2.7K",
                              percent: 70,
                            },
                            {
                              rank: "3",
                              name: "Falling Stars",
                              streams: "2.1K",
                              percent: 54,
                            },
                            {
                              rank: "4",
                              name: "Lost in Time",
                              streams: "1.8K",
                              percent: 44,
                            },
                          ].map((t) => (
                            <div
                              key={t.rank}
                              className="flex items-center gap-2.5 sm:gap-3 text-[12px] sm:text-[13px]">
                              <span className="w-3 text-[#85898D] text-center font-mono">
                                {t.rank}
                              </span>
                              <div className="w-5 h-5 rounded bg-[#FF762B]/15 flex items-center justify-center shrink-0">
                                <Music2 className="w-3 h-3 text-[#FF762B]" />
                              </div>
                              <span className="text-white w-24 sm:w-32 truncate font-medium">
                                {t.name}
                              </span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#FF762B] to-[#FFAA57]"
                                  style={{ width: `${t.percent}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-[#B6B8BA] font-medium text-[11px]">
                                {t.streams}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#85898D] italic pt-3 mt-4 border-t border-white/[0.06]">
                      *Illustrative artist analytics dashboard representation.
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── 4. PLATFORM STATISTICS STRIP ─── */}
        <section className="px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl bg-[#0E1113] border border-white/[0.08] p-5 sm:p-7 shadow-xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                <div className="flex items-center gap-3.5 sm:px-4">
                  <div className="w-11 h-11 rounded-full bg-[#FF762B]/10 border border-[#FF762B]/20 flex items-center justify-center shrink-0">
                    <Mic className="w-5 h-5 text-[#FF762B]" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      10K+
                    </div>
                    <div className="text-[12px] text-[#85898D]">Artists</div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
                  <div className="w-11 h-11 rounded-full bg-[#FF762B]/10 border border-[#FF762B]/20 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5 text-[#FF762B] fill-current" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      1M+
                    </div>
                    <div className="text-[12px] text-[#85898D]">
                      Streams Delivered
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
                  <div className="w-11 h-11 rounded-full bg-[#FF762B]/10 border border-[#FF762B]/20 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-[#FF762B]" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      180+
                    </div>
                    <div className="text-[12px] text-[#85898D]">Countries</div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 pt-4 sm:pt-0 sm:px-4">
                  <div className="w-11 h-11 rounded-full bg-[#FF762B]/10 border border-[#FF762B]/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-[#FF762B]" />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      99.9%
                    </div>
                    <div className="text-[12px] text-[#85898D]">Uptime</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── 5. HOW IT WORKS ─── */}
        <section
          id="how-it-works"
          className="px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 sm:mb-16">
              <div>
                <div className="text-[11px] sm:text-[12px] font-semibold tracking-wider text-[#FF762B] uppercase mb-2">
                  How It Works
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-semibold text-white tracking-tight leading-[1.12]">
                  Start your journey in 4 simple steps.
                </h2>
              </div>
              <p className="text-[14px] sm:text-[15px] text-[#85898D] max-w-sm">
                From your first upload to fans worldwide.
              </p>
            </div>

            {/* 4 Steps Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {[
                {
                  step: "01",
                  title: "Create Account",
                  desc: "Sign up in seconds and set up your artist profile.",
                  icon: UserPlus,
                },
                {
                  step: "02",
                  title: "Upload Song",
                  desc: "Upload your music and artwork with fast verification.",
                  icon: CloudUpload,
                },
                {
                  step: "03",
                  title: "Review",
                  desc: "We review your track and ensure audio quality standards.",
                  icon: ShieldCheck,
                },
                {
                  step: "04",
                  title: "Go Live",
                  desc: "Your music becomes available worldwide to real fans.",
                  icon: Radio,
                },
              ].map((s, idx) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="rounded-2xl bg-[#121618] border border-white/[0.08] hover:border-[#FF762B]/30 p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_8px_30px_rgba(255,118,43,0.1)]">
                  <div>
                    <div className="flex items-center justify-between mb-4 sm:mb-5">
                      <span className="text-[12px] font-semibold text-[#FFAA57] bg-[#FF762B]/10 border border-[#FF762B]/20 rounded-md px-2 py-0.5 font-mono">
                        {s.step}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-[#181C1F] border border-white/[0.08] flex items-center justify-center text-[#FF762B]">
                        <s.icon className="w-5 h-5 text-[#FF762B]" />
                      </div>
                    </div>
                    <h3 className="text-[16px] sm:text-[17px] font-semibold text-white mb-2">
                      {s.title}
                    </h3>
                    <p className="text-[13px] text-[#B6B8BA] leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 6. SUCCESS STORIES ─── */}
        <section
          id="success-stories"
          className="px-4 sm:px-6 lg:px-8 py-14 sm:py-24 bg-[#0E1113]/50 border-t border-white/[0.06] scroll-mt-20">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-left mb-10 sm:mb-16">
              <div className="text-[11px] sm:text-[12px] font-semibold tracking-wider text-[#FF762B] uppercase mb-2">
                Success Stories
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-semibold text-white tracking-tight leading-[1.12] mb-3">
                Artists who are growing globally.
              </h2>
              <p className="text-[14px] sm:text-[16px] text-[#85898D] max-w-xl">
                Join thousands of independent artists reaching new audiences
                every day.
              </p>
            </div>

            {/* Testimonial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {[
                {
                  name: "Rohan Mehta",
                  role: "Indie Artist",
                  quote:
                    "Artist Studio helped me reach listeners in countries I never imagined. The dashboard makes tracking every release completely effortless.",
                  img: "/avatar-rohan.jpg",
                },
                {
                  name: "Priya Sharma",
                  role: "Singer & Songwriter",
                  quote:
                    "The analytics help me understand my audience and plan better releases. Having honest listeners engage with my music is priceless.",
                  img: "/avatar-priya.jpg",
                },
                {
                  name: "Aman Verma",
                  role: "Hip-Hop Artist",
                  quote:
                    "Uploading and reaching a global audience is so simple and professional. Fast approvals and clean distribution give independent artists real power.",
                  img: "/avatar-aman.jpg",
                },
              ].map((t, idx) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="rounded-2xl bg-[#121618] border border-white/[0.08] hover:border-[#FF762B]/30 p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_10px_30px_rgba(255,118,43,0.1)]">
                  <div>
                    {/* Artist Header */}
                    <div className="flex items-center gap-3.5 mb-4 sm:mb-5">
                      <img
                        src={t.img}
                        alt={t.name}
                        className="w-12 h-12 rounded-full border-2 border-[#FF762B]/30 object-cover shadow-[0_2px_12px_rgba(255,118,43,0.2)]"
                      />
                      <div>
                        <div className="text-[15px] font-semibold text-white">
                          {t.name}
                        </div>
                        <div className="text-[12px] text-[#FFAA57]">
                          {t.role}
                        </div>
                      </div>
                    </div>

                    {/* Quote */}
                    <p className="text-[13px] sm:text-[14px] text-[#B6B8BA] leading-relaxed mb-5 italic">
                      "{t.quote}"
                    </p>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center gap-1 pt-4 border-t border-white/[0.06] text-[#FFAA57]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. FAQ ACCORDION ─── */}
        <section
          id="faq"
          className="px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-16">
              <div className="text-[11px] sm:text-[12px] font-semibold tracking-wider text-[#FF762B] uppercase mb-2">
                Frequently Asked Questions
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-3">
                Everything you need to know.
              </h2>
              <p className="text-[14px] sm:text-[16px] text-[#85898D]">
                Have questions before uploading? Here are the most common
                answers.
              </p>
            </div>

            <div className="space-y-3.5">
              {faqs.map((f, i) => {
                const isOpen = expandedFaq === i;
                return (
                  <div
                    key={f.q}
                    className="rounded-2xl bg-[#121618] border border-white/[0.08] overflow-hidden transition-colors hover:border-white/15">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : i)}
                      className="w-full px-5 sm:px-6 py-4.5 sm:py-5 text-left flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF762B]"
                      aria-expanded={isOpen}>
                      <span className="text-[15px] sm:text-[16px] font-medium text-white">
                        {f.q}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#FFAA57] shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="px-5 sm:px-6 pb-5 pt-1 text-[13px] sm:text-[14px] text-[#B6B8BA] leading-relaxed border-t border-white/[0.04]">
                          {f.a}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── 8. FINAL CINEMATIC CTA ─── */}
        <section className="px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative rounded-3xl overflow-hidden border border-[#FF762B]/35 bg-[#121618] shadow-[0_15px_50px_rgba(255,118,43,0.18)]">
              {/* Studio Background Image with Smooth Mask */}
              <div className="absolute inset-0 z-0">
                <img
                  src="/cta-banner.jpg"
                  alt="Studio Production Console"
                  className="w-full h-full object-cover object-left opacity-35 filter brightness-75 contrast-125"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080A0B]/85 via-[#121618]/90 to-[#121618]" />
              </div>

              {/* CTA Content Container */}
              <div className="relative z-10 px-6 sm:px-12 py-10 sm:py-16 flex flex-col md:flex-row items-center justify-between gap-7 sm:gap-8">
                <div className="text-center md:text-left max-w-xl">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight mb-2.5">
                    Your music deserves a bigger stage.
                  </h2>
                  <p className="text-[14px] sm:text-[16px] text-[#B6B8BA]">
                    Join a global community of independent artists and make your
                    sound heard.
                  </p>
                </div>

                <div className="shrink-0 w-full md:w-auto">
                  <Link
                    to="/artist/signup"
                    className="w-full md:w-auto h-12 sm:h-13 px-8 sm:px-9 rounded-full bg-gradient-to-r from-[#FF762B] to-[#E55A13] hover:from-[#FF8238] hover:to-[#EB661F] text-white font-medium text-[15px] flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(255,118,43,0.4)] hover:shadow-[0_12px_40px_rgba(255,118,43,0.55)] hover:-translate-y-0.5 transition-all">
                    Create Artist Account
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ─── 9. FOOTER ─── */}
      <footer className="border-t border-white/[0.08] bg-[#080A0B] pt-12 sm:pt-16 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 text-center md:text-left">
            {/* Brand column */}
            <div>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2.5">
                <img
                  src="/logo.png"
                  alt="Artist Studio"
                  className="w-8 h-8 object-contain"
                />
                <span className="text-[17px] font-semibold text-white tracking-tight">
                  Artist Studio
                </span>
              </div>
              <p className="text-[13px] text-[#85898D] max-w-xs">
                Empowering independent artists worldwide with modern
                distribution and analytics.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-[13px] text-[#B6B8BA]">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-white transition-colors">
                How It Works
              </a>
              <a
                href="#analytics"
                className="hover:text-white transition-colors">
                Analytics
              </a>
              <a
                href="#success-stories"
                className="hover:text-white transition-colors">
                Success Stories
              </a>
              <a href="#faq" className="hover:text-white transition-colors">
                FAQ
              </a>
              <Link
                to="/artist/login"
                className="hover:text-white transition-colors">
                Log In
              </Link>
            </div>

            {/* Social Icons & Status */}
            <div className="flex items-center gap-4 text-[#85898D]">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-[#121618] border border-white/[0.08] flex items-center justify-center hover:text-white hover:border-[#FF762B]/40 transition-colors"
                aria-label="Twitter">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-[#121618] border border-white/[0.08] flex items-center justify-center hover:text-white hover:border-[#FF762B]/40 transition-colors"
                aria-label="Instagram">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.13-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-[#121618] border border-white/[0.08] flex items-center justify-center hover:text-white hover:border-[#FF762B]/40 transition-colors"
                aria-label="YouTube">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-white/[0.06] text-center text-[#85898D] text-[12px] sm:text-[13px]">
            © {new Date().getFullYear()} Artist Studio. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
