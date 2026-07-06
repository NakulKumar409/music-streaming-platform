import { Link } from "react-router-dom";
import {
  Upload,
  BarChart3,
  DollarSign,
  Music,
  ArrowRight,
  Users,
  PlayCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  Mic2,
  Activity,
  Layers,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types & constants
───────────────────────────────────────────── */
type QuickAction = {
  icon: React.ElementType;
  title: string;
  desc: string;
  to: string;
  label: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Upload,
    title: "Upload Content",
    desc: "Publish a new audio or video track to your profile.",
    to: "/artist/content-upload",
    label: "Upload Now",
  },
  {
    icon: BarChart3,
    title: "View Analytics",
    desc: "Track plays, subscribers, and revenue in real time.",
    to: "/artist/analytics-summary",
    label: "Open Analytics",
  },
  {
    icon: DollarSign,
    title: "Manage Pricing",
    desc: "Set or update your subscription price for fans.",
    to: "/artist/pricing",
    label: "Manage Plan",
  },
  {
    icon: Layers,
    title: "Content History",
    desc: "Review all your uploaded tracks and their status.",
    to: "/artist/content-history",
    label: "View History",
  },
];

const STEPS = [
  {
    icon: Upload,
    step: "01",
    title: "Upload a Track",
    desc: "Submit your audio or video with cover art, title, and description.",
    status: "pending" as const,
  },
  {
    icon: CheckCircle2,
    step: "02",
    title: "Content Review",
    desc: "Our moderation team reviews your submission within 24 hours.",
    status: "pending" as const,
  },
  {
    icon: Activity,
    step: "03",
    title: "Go Live",
    desc: "Your track becomes discoverable to thousands of active listeners.",
    status: "pending" as const,
  },
  {
    icon: TrendingUp,
    step: "04",
    title: "Grow & Earn",
    desc: "Build your subscriber base and earn revenue from your content.",
    status: "pending" as const,
  },
];

const LOCKED_METRICS = [
  {
    icon: PlayCircle,
    label: "Total Plays",
    sub: "Cumulative stream count",
  },
  {
    icon: Users,
    label: "Subscribers",
    sub: "Active fan subscriptions",
  },
  {
    icon: DollarSign,
    label: "Earnings",
    sub: "Revenue this month",
  },
  {
    icon: Music,
    label: "Tracks Live",
    sub: "Approved content count",
  },
];

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

/** Thin top-coloured card for quick actions */
function ActionCard({ item }: { item: QuickAction }) {
  return (
    <Link
      to={item.to}
      className="group relative flex flex-col gap-4 rounded-2xl border border-white/[0.07] p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{ background: "rgb(var(--color-card-rgb) / 0.7)" }}
    >
      {/* Accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "var(--gradient-primary)" }}
      />

      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/[0.07] transition-colors duration-300 group-hover:border-primary/30"
        style={{ background: "rgb(var(--color-surface-rgb) / 0.8)" }}
      >
        <item.icon size={20} className="text-primary" />
      </div>

      {/* Copy */}
      <div className="flex-1">
        <h3 className="text-white font-semibold text-[15px] mb-1.5 group-hover:text-primary transition-colors duration-200">
          {item.title}
        </h3>
        <p className="text-white/45 text-sm leading-relaxed">{item.desc}</p>
      </div>

      {/* Footer link */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-white/35 group-hover:text-primary transition-colors duration-200">
        {item.label}
        <ChevronRight
          size={13}
          className="group-hover:translate-x-1 transition-transform duration-200"
        />
      </div>
    </Link>
  );
}

/** Locked metric placeholder */
function LockedMetric({
  item,
}: {
  item: (typeof LOCKED_METRICS)[number];
}) {
  return (
    <div
      className="relative flex items-center gap-4 rounded-2xl border border-dashed border-white/10 p-5 overflow-hidden"
      style={{ background: "rgb(var(--color-surface-rgb) / 0.3)" }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[1px]" />

      <div className="relative z-10 flex items-center gap-4 w-full">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
          <item.icon size={18} className="text-white/20" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/25 font-semibold text-[14px] truncate">{item.label}</p>
          <p className="text-white/18 text-xs mt-0.5">{item.sub}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/20 flex-shrink-0">
          <Lock size={11} />
          Locked
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function ArtistDashboardPage() {
  return (
    <div className="space-y-8 animate-fadeIn pb-10">

      {/* ══════════════════════════════════════
          HEADER ROW
      ══════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mic2 size={16} className="text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Artist Studio
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome to Your Dashboard
          </h1>
          <p className="text-white/45 text-sm mt-1">
            Upload your first track to activate analytics, earnings, and audience tools.
          </p>
        </div>

        <Link
          to="/artist/content-upload"
          className="self-start sm:self-center inline-flex items-center gap-2 h-10 px-5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap"
          style={{
            background: "var(--gradient-primary)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          <Upload size={15} />
          Upload Track
        </Link>
      </div>

      {/* ══════════════════════════════════════
          STATUS BANNER
      ══════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl border p-6 md:p-8"
        style={{
          borderColor: "rgb(var(--color-primary-rgb) / 0.20)",
          background:
            "linear-gradient(135deg, rgb(var(--color-primary-rgb) / 0.10) 0%, rgb(var(--color-surface-rgb) / 0.5) 60%, rgb(var(--color-card-rgb) / 0.4) 100%)",
        }}
      >
        {/* Corner glow */}
        <div
          className="pointer-events-none absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl opacity-40"
          style={{ background: "var(--color-primary)" }}
        />

        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          {/* Icon block */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgb(var(--color-primary-rgb) / 0.15)",
              border: "1px solid rgb(var(--color-primary-rgb) / 0.25)",
            }}
          >
            <Music size={28} className="text-primary" />
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border"
                style={{
                  color: "rgb(52 211 153)",
                  borderColor: "rgb(52 211 153 / 0.25)",
                  background: "rgb(52 211 153 / 0.08)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Studio Active
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              Your artist profile is ready
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xl">
              Your account has been approved. Upload your first track to go live
              and start reaching listeners. Content is reviewed within 24 hours.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Link
              to="/artist/content-upload"
              className="inline-flex items-center justify-center gap-2 h-11 px-7 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              <Upload size={15} />
              Upload First Track
            </Link>
            <Link
              to="/artist/account"
              className="inline-flex items-center justify-center gap-1.5 h-11 px-7 rounded-xl font-medium text-sm text-white/50 border border-white/8 bg-white/5 hover:bg-white/10 hover:text-white/80 transition-all duration-200"
            >
              Complete Profile
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          QUICK ACTIONS
      ══════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Quick Actions</h2>
          <span className="text-xs text-white/30">4 tools available</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((item) => (
            <ActionCard key={item.to} item={item} />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          METRICS + HOW IT WORKS (2-col)
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Locked Metrics ── */}
        <div
          className="rounded-2xl border border-white/[0.07] p-6"
          style={{ background: "rgb(var(--color-card-rgb) / 0.5)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">Key Metrics</h2>
              <p className="text-white/35 text-xs mt-0.5">Available after first upload</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/30 bg-white/5 border border-white/8 rounded-full px-3 py-1.5">
              <Lock size={10} />
              Locked
            </div>
          </div>

          <div className="space-y-3">
            {LOCKED_METRICS.map((item) => (
              <LockedMetric key={item.label} item={item} />
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <Link
              to="/artist/content-upload"
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm text-white transition-all duration-200"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              <Upload size={14} />
              Upload to Unlock Metrics
            </Link>
          </div>
        </div>

        {/* ── How It Works ── */}
        <div
          className="rounded-2xl border border-white/[0.07] p-6"
          style={{ background: "rgb(var(--color-card-rgb) / 0.5)" }}
        >
          <div className="mb-5">
            <h2 className="text-base font-semibold text-white">Getting Started</h2>
            <p className="text-white/35 text-xs mt-0.5">Follow these steps to go live</p>
          </div>

          <div className="space-y-1">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                {/* Vertical connector */}
                {i < STEPS.length - 1 && (
                  <div
                    className="absolute left-[22px] top-[46px] w-px h-[calc(100%-10px)]"
                    style={{
                      background:
                        "linear-gradient(180deg, rgb(var(--color-primary-rgb) / 0.20) 0%, transparent 100%)",
                    }}
                  />
                )}

                <div className="group flex items-start gap-4 rounded-xl p-3 hover:bg-white/[0.03] transition-colors duration-200">
                  {/* Step circle */}
                  <div
                    className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors duration-200"
                    style={{
                      background: "rgb(var(--color-surface-rgb) / 0.8)",
                      borderColor: "rgb(var(--color-primary-rgb) / 0.20)",
                    }}
                  >
                    <step.icon size={18} className="text-primary/70" />
                    <span
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{
                        background: "var(--color-primary)",
                        color: "#fff",
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>

                  <div className="pt-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white/85 font-semibold text-[14px]">
                        {step.title}
                      </h4>
                      {i === 0 && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgb(var(--color-primary-rgb) / 0.15)",
                            color: "var(--color-primary)",
                          }}
                        >
                          Start here
                        </span>
                      )}
                    </div>
                    <p className="text-white/35 text-xs leading-relaxed mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs text-white/30">
            <Clock size={13} />
            Content review typically takes less than 24 hours.
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          BOTTOM INFO STRIP
      ══════════════════════════════════════ */}
      <div
        className="rounded-2xl border border-white/[0.07] p-5 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ background: "rgb(var(--color-surface-rgb) / 0.4)" }}
      >
        <div className="flex items-start gap-3 flex-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{
              background: "rgb(var(--color-primary-rgb) / 0.10)",
              borderColor: "rgb(var(--color-primary-rgb) / 0.20)",
            }}
          >
            <Activity size={16} className="text-primary/70" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium">
              Your earnings start immediately after approval
            </p>
            <p className="text-white/35 text-xs mt-0.5">
              Every subscription to your profile earns you revenue based on your
              pricing plan. Set your price before going live.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Link
            to="/artist/pricing"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
          >
            Set Pricing
          </Link>
          <Link
            to="/artist/content-upload"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "0 0 20px rgb(var(--color-primary-rgb) / 0.20)",
            }}
          >
            Upload Track
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

    </div>
  );
}
