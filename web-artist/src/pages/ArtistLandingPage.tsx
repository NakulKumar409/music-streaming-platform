import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Smartphone,
  Zap,
  Shield,
  BarChart3,
  CloudUpload,
  TrendingUp,
  ShieldCheck,
  Users,
  Globe,
  Heart,
  Activity,
  Lock,
  Music2,
  UserPlus,
} from "lucide-react";

function BrandLogo() {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}>
      <img
        src="/logo.png"
        alt="Brand Logo"
        className="h-[40px] w-[40px] sm:h-[44px] sm:w-[44px] object-contain"
      />
      <span className="text-lg sm:text-xl font-bold tracking-wide text-white">
        Artist Studio
      </span>
    </motion.div>
  );
}

function GlowOrb() {
  return (
    <div className="relative w-full h-[280px] sm:h-[420px] flex items-center justify-center">
      {/* Concentric ring glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-[250px] sm:w-[380px] h-[250px] sm:h-[380px] rounded-full border border-[#c97a54]/10" />
        <div className="absolute w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] rounded-full border border-[#c97a54]/20" />
        <div className="absolute w-[150px] sm:w-[220px] h-[150px] sm:h-[220px] rounded-full border border-[#c97a54]/30" />
        <div className="absolute w-[250px] sm:w-[380px] h-[250px] sm:h-[380px] rounded-full bg-[#e85d2c]/10 blur-[80px]" />
      </div>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative w-[140px] sm:w-[200px] h-[140px] sm:h-[200px] rounded-full bg-gradient-to-br from-[#1a0e0a] to-black border border-[#c97a54]/40 flex items-center justify-center shadow-[0_0_80px_rgba(232,93,44,0.5),inset_0_0_60px_rgba(232,93,44,0.2)]">
        <Music2
          className="w-14 sm:w-20 h-14 sm:h-20 text-[#e85d2c]"
          strokeWidth={2.5}
        />
      </motion.div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  sub,
}: {
  icon: any;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#e85d2c] mt-0.5 shrink-0" />
      <div>
        <div className="text-[13px] sm:text-[15px] font-semibold text-white">
          {title}
        </div>
        <div className="text-[11px] sm:text-[13px] text-[#8d7b77] leading-tight mt-0.5 max-w-[120px] sm:max-w-[140px]">
          {sub}
        </div>
      </div>
    </div>
  );
}

function FeatureTile({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-[#15100e] border border-white/5 p-4 sm:p-6 rounded-2xl text-center hover:border-[#c97a54]/20 transition-colors">
      <div className="h-12 w-12 sm:h-14 sm:w-14 mx-auto bg-[#c97a54]/10 border border-[#c97a54]/15 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#e85d2c]" />
      </div>
      <h3 className="text-[15px] sm:text-[18px] text-white font-semibold mb-1.5 sm:mb-2">
        {title}
      </h3>
      <p className="text-[13px] sm:text-[15px] text-[#8d7b77] leading-relaxed">
        {desc}
      </p>
    </motion.div>
  );
}

function StatItem({
  icon: Icon,
  value,
  label,
}: {
  icon: any;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2">
      <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[#c97a54]/10 border border-[#c97a54]/15 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#e85d2c]" />
      </div>
      <div>
        <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
          {value}
        </div>
        <div className="text-[11px] sm:text-[13px] text-[#8d7b77] mt-0.5 sm:mt-1">
          {label}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-white/5 bg-[#15100e]/70 backdrop-blur-sm px-3 sm:px-4 py-3 sm:py-3.5 hover:border-[#c97a54]/25 transition-colors">
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[#c97a54]/10 border border-[#c97a54]/20 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#e85d2c]" />
      </div>
      <div>
        <div className="text-[15px] sm:text-[18px] font-semibold text-white mb-0.5">
          {title}
        </div>
        <div className="text-[13px] sm:text-[15px] text-[#8d7b77]">{desc}</div>
      </div>
    </motion.div>
  );
}

export default function ArtistLandingPage() {
  const backgroundStyle = useMemo(
    () =>
      ({
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(255, 122, 47, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(255, 155, 92, 0.04) 0%, transparent 50%),
          linear-gradient(to bottom, #0A0A0A 0%, #0A0A0A 100%)
        `,
      } as const),
    []
  );

  return (
    <div
      className="min-h-screen w-full bg-[#0A0A0A] text-white overflow-x-hidden font-sans"
      style={backgroundStyle}>
      {/* grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* HEADER */}
      <motion.header
        className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <BrandLogo />
          <nav className="flex items-center gap-3 sm:gap-4">
            <a
              href="http://localhost:8081"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 h-9 sm:h-10 px-4 sm:px-5 rounded-full border border-[#c97a54]/30 bg-[#c97a54]/10 text-[13px] sm:text-[14px] font-medium text-[#e8a87c] hover:bg-[#c97a54]/20 transition-all">
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Fan App
            </a>
            <Link
              to="/artist/login"
              className="text-[14px] sm:text-[16px] font-medium text-[#b8a6a1] hover:text-white transition-colors">
              Log in
            </Link>
          </nav>
        </div>
      </motion.header>

      {/* HERO SECTION */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="text-left">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05] mb-3 sm:mb-4">
              Your Music. <br />
              Global Stage.
            </motion.h1>
            <p className="text-base sm:text-lg md:text-xl text-[#b8a6a1] max-w-md leading-relaxed mb-6 sm:mb-8">
              Upload your tracks, connect with fans, and grow your music career
              with powerful artist tools.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:mb-12">
              <Link
                to="/artist/signup"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-9 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[15px] sm:text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(232,93,44,0.35)] hover:shadow-[0_15px_40px_rgba(232,93,44,0.5)] transition-all hover:-translate-y-0.5">
                Create Artist Account
              </Link>
              <Link
                to="/artist/login"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-9 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-[15px] sm:text-[16px] font-semibold text-white hover:bg-white/[0.06] transition-all">
                Log In
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 sm:gap-8 border-t border-white/5 pt-5 sm:pt-6">
              <TrustItem
                icon={Zap}
                title="Fast Approval"
                sub="Get reviewed and approved quickly."
              />
              <TrustItem
                icon={Shield}
                title="Secure Uploads"
                sub="Your music is safe and protected."
              />
              <TrustItem
                icon={BarChart3}
                title="Real-Time Analytics"
                sub="Track your streams and audience."
              />
            </div>

            {/* Fan banner */}
            <div className="mt-8 sm:mt-10 rounded-2xl border border-[#c97a54]/15 bg-[#1a0e0a]/40 px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[#6a352c]/30 border border-[#c97a54]/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#e8a87c]" />
                </div>
                <div>
                  <div className="text-[13px] sm:text-[15px] font-semibold text-white">
                    Already have a fan?
                  </div>
                  <div className="text-[11px] sm:text-[13px] text-[#8d7b77]">
                    Open the fan app to stream and support artists.
                  </div>
                </div>
              </div>
              <a
                href="http://localhost:8081"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto h-9 sm:h-10 px-5 sm:px-6 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[12px] sm:text-[14px] font-semibold text-white hover:-translate-y-0.5 transition-transform">
                Open Fan App
              </a>
            </div>
          </div>

          <GlowOrb />
        </div>
      </section>

      {/* VALUE SECTION */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-black/40 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4 tracking-tight">
              Everything you need <br className="hidden md:block" />
              to <span className="text-[#e85d2c]">build</span> your career
            </motion.h2>
            <p className="text-[14px] sm:text-[17px] text-[#b8a6a1] max-w-xl mx-auto">
              Our platform is built for independent artists who want to focus on
              creating, not managing complex distribution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8 sm:mb-12">
            <FeatureTile
              icon={CloudUpload}
              title="Upload Easily"
              desc="Upload your songs in minutes. We handle the rest."
            />
            <FeatureTile
              icon={BarChart3}
              title="Track Performance"
              desc="See real-time stats and know your audience better."
            />
            <FeatureTile
              icon={ShieldCheck}
              title="Get Approved"
              desc="Our team ensures your music meets quality standards."
            />
            <FeatureTile
              icon={Users}
              title="Reach Listeners"
              desc="Your music goes live globally. Grow your fanbase."
            />
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-2xl border border-white/5 bg-[#15100e]/60 p-3 sm:p-5">
            <StatItem icon={Users} value="+10K" label="Artists" />
            <StatItem icon={BarChart3} value="+1M" label="Streams Delivered" />
            <StatItem icon={Globe} value="180+" label="Countries" />
            <StatItem icon={Activity} value="99.5%" label="Uptime" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mt-8 sm:mt-12">
            <p className="text-[14px] sm:text-[17px] text-[#b8a6a1] mb-4 sm:mb-5">
              Ready to share your music with the world?
            </p>
            <Link
              to="/artist/signup"
              className="inline-flex h-12 sm:h-14 px-8 sm:px-10 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] items-center text-[15px] sm:text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(232,93,44,0.35)] hover:-translate-y-0.5 transition-all">
              Create Artist Account
            </Link>
          </motion.div>
        </div>
      </section>

      {/* STEPS SECTION */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
        <div className="absolute top-1/2 right-1/4 w-[700px] h-[700px] bg-[#e85d2c]/10 blur-[140px] rounded-full pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 items-center mb-12 sm:mb-20">
            <div>
              <p className="text-[13px] sm:text-[15px] text-[#8d7b77] mb-3 sm:mb-4">
                From your first upload to your
                <br />
                biggest fan.
              </p>
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.02]">
                We're with you <br />
                <span className="text-[#e85d2c]">every</span> step.
              </h2>
            </div>

            {/* Isometric stairs - Hidden on mobile */}
            <div
              className="relative h-[340px] hidden lg:block"
              style={{ perspective: "1200px" }}>
              <div
                className="absolute inset-0"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "rotateX(55deg) rotateZ(-35deg)",
                }}>
                {[0, 1, 2, 3].map((i) => {
                  const size = 110;
                  const rise = 26;
                  const offset = i * size * 0.55;
                  return (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${50 + offset}px`,
                        top: `${180 - offset}px`,
                        width: `${size}px`,
                        height: `${size}px`,
                        transform: `translateZ(${i * rise}px)`,
                        transformStyle: "preserve-3d",
                      }}>
                      <div
                        className="absolute inset-0 rounded-[2px]"
                        style={{
                          background:
                            "linear-gradient(135deg, #1a0f0b 0%, #0a0604 100%)",
                          boxShadow:
                            "inset 0 0 0 1px rgba(232,93,44,0.25), 0 0 30px rgba(232,93,44,0.35)",
                        }}
                      />
                      <div
                        className="absolute left-0 right-0 bottom-0"
                        style={{
                          height: `${rise}px`,
                          transform: `rotateX(-90deg)`,
                          transformOrigin: "bottom",
                          background:
                            "linear-gradient(180deg, #e85d2c 0%, #7d3b20 100%)",
                          boxShadow:
                            "0 0 25px #e85d2c, 0 0 50px rgba(232,93,44,0.6)",
                        }}
                      />
                      <div
                        className="absolute"
                        style={{
                          left: "50%",
                          top: "50%",
                          transform: `translate(-50%, -50%) translateZ(60px) rotateZ(35deg) rotateX(-55deg)`,
                        }}>
                        <div className="w-10 h-10 rounded-full bg-black border-2 border-[#e85d2c] flex items-center justify-center text-[14px] font-bold text-white shadow-[0_0_25px_rgba(232,93,44,0.9)]">
                          {i + 1}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Steps Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 border-t border-white/5 pt-8 sm:pt-10">
            {[
              {
                n: "1",
                title: "Create Account",
                desc: "Sign up in seconds. No credit card required.",
                icon: UserPlus,
              },
              {
                n: "2",
                title: "Upload Song",
                desc: "Upload your music and artwork with ease.",
                icon: Music2,
              },
              {
                n: "3",
                title: "Get Approved",
                desc: "We review your track and ensure top quality.",
                icon: ShieldCheck,
              },
              {
                n: "4",
                title: "Reach Listeners",
                desc: "Go live globally and watch your audience grow.",
                icon: Users,
              },
            ].map((s) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="group bg-[#15100e] border border-white/5 rounded-2xl p-5 sm:p-6 hover:border-[#c97a54]/30 hover:bg-[#1a1514] transition-all duration-300 hover:shadow-[0_10px_40px_rgba(232,93,44,0.1)] hover:-translate-y-1">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="text-3xl sm:text-4xl font-bold text-[#e85d2c] group-hover:scale-110 transition-transform duration-300">
                    {s.n}
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[#c97a54]/10 border border-[#c97a54]/15 flex items-center justify-center group-hover:bg-[#c97a54]/20 group-hover:border-[#c97a54]/30 transition-all duration-300">
                    <s.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#e85d2c] group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>

                <h4 className="text-[17px] sm:text-[19px] font-semibold text-white mb-2 group-hover:text-[#e85d2c] transition-colors duration-300">
                  {s.title}
                </h4>

                <p className="text-[14px] sm:text-[15px] text-[#8d7b77] leading-relaxed group-hover:text-[#b8a6a1] transition-colors duration-300">
                  {s.desc}
                </p>

                <div className="mt-3 h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-[#e85d2c] to-transparent transition-all duration-500 rounded-full" />
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-10 sm:mt-14 rounded-2xl border border-[#c97a54]/15 bg-gradient-to-r from-[#1a0e0a] to-[#15100e] p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="text-xl sm:text-2xl font-bold text-white text-center sm:text-left">
              Start your music journey today.
            </h3>
            <Link
              to="/artist/signup"
              className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-9 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[14px] sm:text-[15px] font-semibold text-white hover:-translate-y-0.5 transition-transform">
              Create Artist Account
            </Link>
          </motion.div>
        </div>
      </section>

      {/* POWERFUL TOOLS SECTION */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-black/40 border-y border-white/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.05] mb-3 sm:mb-6">
              Powerful Tools. <br />
              Real Results.
            </motion.h2>
            <p className="text-[14px] sm:text-[17px] text-[#b8a6a1] max-w-md leading-relaxed mb-6 sm:mb-8">
              Everything you need to upload, analyze, and grow your music career
              — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
              <Link
                to="/artist/signup"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-9 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[15px] sm:text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(232,93,44,0.35)] hover:-translate-y-0.5 transition-all">
                Create Artist Account
              </Link>
              <Link
                to="/artist/login"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-9 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-[15px] sm:text-[16px] font-semibold text-white hover:bg-white/[0.06] transition-all">
                Log In
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-5 text-[12px] sm:text-[14px]">
              <span className="flex items-center gap-1.5 text-[#b8a6a1]">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e85d2c]" />{" "}
                Fast Approval
              </span>
              <span className="flex items-center gap-1.5 text-[#b8a6a1]">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e85d2c]" />{" "}
                Secure Uploads
              </span>
              <span className="flex items-center gap-1.5 text-[#b8a6a1]">
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e85d2c]" />{" "}
                Real-Time Analytics
              </span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl bg-[#0f0a08] border border-white/5 shadow-2xl overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-[14px] sm:text-[16px] font-semibold text-white">
                Dashboard
              </span>
              <span className="text-[11px] sm:text-[13px] text-[#8d7b77] px-2 sm:px-3 py-1 rounded-md bg-white/5">
                This Month ▾
              </span>
            </div>
            <div className="p-3 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: "Streams", value: "12.5K", delta: "+12.4%" },
                { label: "Listeners", value: "8.2K", delta: "+9.5%" },
                { label: "Countries", value: "45", delta: "" },
                { label: "Downloads", value: "2.1K", delta: "+7.2%" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg bg-[#15100e] border border-white/5 p-2 sm:p-3">
                  <div className="text-[10px] sm:text-[12px] text-[#8d7b77] mb-0.5 sm:mb-1">
                    {s.label}
                  </div>
                  <div className="text-[14px] sm:text-[18px] font-bold text-white">
                    {s.value}
                  </div>
                  {s.delta && (
                    <div className="text-[10px] sm:text-[12px] text-[#5fbf86] mt-0.5">
                      {s.delta}
                    </div>
                  )}
                  <div className="mt-1.5 sm:mt-2 h-4 sm:h-5">
                    <svg viewBox="0 0 60 20" className="w-full h-full">
                      <polyline
                        points="0,15 10,12 20,14 30,8 40,10 50,5 60,7"
                        fill="none"
                        stroke="#5fbf86"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 sm:px-5 pb-3 sm:pb-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[13px] sm:text-[15px] font-semibold text-white">
                  Top Tracks
                </span>
                <span className="text-[10px] sm:text-[12px] text-[#8d7b77]">
                  View all
                </span>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {[
                  { n: 1, name: "Sunset Dreams", v: "3.2K", w: 92 },
                  { n: 2, name: "Midnight Drive", v: "2.7K", w: 78 },
                  { n: 3, name: "Falling Stars", v: "2.1K", w: 60 },
                  { n: 4, name: "Lost in Time", v: "1.8K", w: 52 },
                ].map((t) => (
                  <div
                    key={t.n}
                    className="flex items-center gap-2 sm:gap-3 text-[12px] sm:text-[14px]">
                    <span className="text-[#8d7b77] w-2.5 sm:w-3">{t.n}</span>
                    <div className="h-6 w-6 sm:h-7 sm:w-7 rounded bg-[#c97a54]/15 flex items-center justify-center">
                      <Music2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e85d2c]" />
                    </div>
                    <span className="text-white w-16 sm:w-24 truncate">
                      {t.name}
                    </span>
                    <div className="flex-1 h-1 sm:h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#e85d2c] to-[#a3441e]"
                        style={{ width: `${t.w}%` }}
                      />
                    </div>
                    <span className="text-[#b8a6a1] w-8 sm:w-10 text-right">
                      {t.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* New here banner */}
        <div className="max-w-7xl mx-auto mt-8 sm:mt-10 rounded-2xl border border-white/5 bg-[#15100e]/60 px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#c97a54]/15 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#e85d2c]" />
            </div>
            <div>
              <div className="text-[13px] sm:text-[15px] font-semibold text-white">
                New here?
              </div>
              <div className="text-[11px] sm:text-[13px] text-[#8d7b77]">
                Join thousands of artists already growing their careers.
              </div>
            </div>
          </div>
          <Link
            to="/artist/signup"
            className="w-full sm:w-auto h-9 sm:h-11 px-5 sm:px-7 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[12px] sm:text-[14px] font-semibold text-white">
            Create Account
          </Link>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-black">
        {/* Concentric orb rings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-[72%] -translate-x-1/2 -translate-y-1/2">
            {[920, 780, 640, 500, 360, 230].map((s, i) => (
              <div
                key={s}
                className="absolute rounded-full border"
                style={{
                  width: `${s}px`,
                  height: `${s}px`,
                  left: `-${s / 2}px`,
                  top: `-${s / 2}px`,
                  borderColor: `rgba(232,93,44,${0.05 + i * 0.05})`,
                }}
              />
            ))}
            <div
              className="absolute rounded-full"
              style={{
                width: "700px",
                height: "700px",
                left: "-350px",
                top: "-350px",
                background:
                  "radial-gradient(circle, rgba(232,93,44,0.18) 0%, rgba(232,93,44,0.06) 40%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-10 items-center">
          {/* Feature pill cards */}
          <div className="space-y-3 sm:space-y-3.5">
            <FeatureRow
              icon={Globe}
              title="Global Reach"
              desc="Your music, available worldwide."
            />
            <FeatureRow
              icon={Heart}
              title="Fan Engagement"
              desc="Connect with fans who love your music."
            />
            <FeatureRow
              icon={BarChart3}
              title="Real-Time Stats"
              desc="Make smarter decisions with live data."
            />
            <FeatureRow
              icon={Lock}
              title="Secure & Fast"
              desc="Safe uploads and lightning fast delivery."
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left">
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.02] mb-3 sm:mb-5">
              Your Sound. <br />
              <span className="text-[#e85d2c]">Limitless</span> Reach.
            </h2>
            <p className="text-[14px] sm:text-[17px] text-[#b8a6a1] max-w-md mx-auto lg:mx-0 mb-6 sm:mb-8 leading-relaxed">
              Upload your music, track your success,
              <br className="hidden sm:block" />
              and build a global fanbase.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                to="/artist/signup"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-9 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[15px] sm:text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(232,93,44,0.45)] hover:-translate-y-0.5 transition-all">
                Create Artist Account
              </Link>
              <Link
                to="/artist/login"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-9 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-[15px] sm:text-[16px] font-semibold text-white hover:bg-white/[0.06] transition-all">
                Log In
              </Link>
            </div>
          </motion.div>
        </div>

        {/* take your fans everywhere */}
        <div className="relative max-w-6xl mx-auto mt-12 sm:mt-20 rounded-2xl border border-[#c97a54]/15 bg-[#1a0e0a]/70 backdrop-blur px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[#6a352c]/30 border border-[#c97a54]/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#e8a87c]" />
            </div>
            <div>
              <div className="text-[13px] sm:text-[15px] font-semibold text-white">
                Take your fans everywhere.
              </div>
              <div className="text-[11px] sm:text-[13px] text-[#8d7b77]">
                Get the Fan App to discover and support new music.
              </div>
            </div>
          </div>
          <a
            href="http://localhost:8081"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto h-9 sm:h-11 px-5 sm:px-7 rounded-full bg-gradient-to-b from-[#e85d2c] to-[#a3441e] flex items-center justify-center text-[12px] sm:text-[14px] font-semibold text-white">
            Open Fan App
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-5 sm:py-8 border-t border-white/5 text-center text-[#8d7b77] text-[12px] sm:text-[14px]">
        © {new Date().getFullYear()} Artist Studio. All rights reserved.
      </footer>
    </div>
  );
}
