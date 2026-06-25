// src/pages/ArtistDashboardPage.tsx
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { http } from "../services/http";
import {
  Music,
  Users,
  DollarSign,
  Headphones,
  TrendingUp,
  BarChart3,
  CreditCard,
  Upload,
  ArrowRight,
  UserPlus,
  Activity,
  PlayCircle,
  Hand,
  Sparkles,
} from "lucide-react";

export default function ArtistDashboardPage() {
  const [stats, setStats] = useState({
    totalPlays: 0,
    subscribers: 0,
    earnings: 0,
    songs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get("/api/v1/artist/dashboard/summary")
      .then((res) => {
        const data = res.data?.stats || {};
        setStats({
          totalPlays: data.totalPlays || 0,
          subscribers: data.subscribers || 0,
          earnings: data.grossEarnings || 0,
          songs: data.totalSongs || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const backgroundStyle = useMemo(
    () => ({
      backgroundImage:
        "radial-gradient(ellipse at 20% 0%, rgba(232,93,44,0.06) 0%, rgba(10,10,10,0.95) 100%)",
    }),
    []
  );

  const statCards = [
    {
      label: "Total Plays",
      value: stats.totalPlays.toLocaleString(),
      icon: PlayCircle,
      change: "+12%",
      color: "text-[#E85D2C]",
    },
    {
      label: "Subscribers",
      value: stats.subscribers.toLocaleString(),
      icon: Users,
      change: "+8%",
      color: "text-emerald-400",
    },
    {
      label: "Earnings",
      value: `₹${stats.earnings.toFixed(2)}`,
      icon: DollarSign,
      change: "+15%",
      color: "text-amber-400",
    },
    {
      label: "Songs",
      value: stats.songs.toString(),
      icon: Music,
      change: "+2",
      color: "text-blue-400",
    },
  ];

  const quickActions = [
    {
      icon: Upload,
      label: "Upload New Track",
      desc: "Share your latest music with fans",
      to: "/artist/content-upload",
      color: "from-[#E85D2C] to-[#C97A54]",
    },
    {
      icon: BarChart3,
      label: "View Analytics",
      desc: "Track your performance and growth",
      to: "/artist/analytics-summary",
      color: "from-[#5468c9] to-[#7c8cdb]",
    },
    {
      icon: CreditCard,
      label: "Manage Pricing",
      desc: "Set subscription and earnings",
      to: "/artist/pricing",
      color: "from-[#54c97a] to-[#3da85e]",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-64 bg-white/10 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[#15100E] border border-white/5 rounded-2xl p-6 h-32"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn" style={backgroundStyle}>
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Welcome back, Artist
            <Hand className="w-8 h-8 text-[#E85D2C]" />
          </h1>
          <p className="text-[#B8A6A1] mt-1">
            Here's what's happening with your music today.
          </p>
        </div>
        <Link
          to="/artist/content-upload"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-sm font-semibold text-white shadow-lg shadow-[#E85D2C]/25 hover:shadow-[#E85D2C]/40 hover:-translate-y-0.5 transition-all">
          <Upload className="w-4 h-4" />
          Upload New Track
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-[#15100E] border border-white/5 rounded-2xl p-6 hover:border-[#E85D2C]/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#E85D2C]/5">
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-6 h-6 ${stat.color}`} />
                <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-[#8D7B77] mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.to}
              className="group bg-[#15100E] border border-white/5 rounded-2xl p-6 hover:border-[#E85D2C]/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#E85D2C]/5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#E85D2C]/10 to-[#C97A54]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-[#E85D2C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-[#E85D2C] transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-sm text-[#8D7B77]">{action.desc}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#8D7B77] group-hover:text-[#E85D2C] transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-[#15100E] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#E85D2C]" />
            Recent Activity
          </h3>
          <Link
            to="/artist/analytics-summary"
            className="text-sm text-[#E85D2C] hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {[
            { location: "Mumbai", time: "12 min ago", type: "listen" },
            { location: "Delhi", time: "24 min ago", type: "listen" },
            { location: "Bangalore", time: "1h ago", type: "subscriber" },
          ].map((activity, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
              {activity.type === "subscriber" ? (
                <UserPlus className="w-4 h-4 text-emerald-400" />
              ) : (
                <PlayCircle className="w-4 h-4 text-[#E85D2C]" />
              )}
              <div className="flex-1">
                <p className="text-sm text-[#B8A6A1]">
                  {activity.type === "subscriber"
                    ? `New subscriber from ${activity.location}`
                    : `New listener from ${activity.location}`}
                </p>
                <p className="text-xs text-[#6b5b57]">{activity.time}</p>
              </div>
              <TrendingUp
                className={`w-4 h-4 ${
                  activity.type === "subscriber"
                    ? "text-emerald-400"
                    : "text-[#E85D2C]"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {stats.songs === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E85D2C]/20 bg-gradient-to-br from-[#E85D2C]/5 via-[#0A0A0A] to-[#0A0A0A] p-8 md:p-12 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(232,93,44,0.08),transparent_70%)]" />
          <div className="relative">
            <div className="mb-6 mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-[#E85D2C] to-[#C97A54] flex items-center justify-center shadow-lg shadow-[#E85D2C]/25">
              <Headphones className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center justify-center gap-2">
              Start Your Music Journey
              <Sparkles className="w-6 h-6 text-[#E85D2C]" />
            </h2>
            <p className="text-[#B8A6A1] max-w-lg mx-auto mb-8 leading-relaxed">
              Upload your first track to unlock analytics, earnings, and
              audience insights. Your journey starts with one song.
            </p>
            <Link
              to="/artist/content-upload"
              className="inline-flex h-[52px] items-center justify-center rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] px-10 text-sm font-bold text-white shadow-lg shadow-[#E85D2C]/25 hover:shadow-[#E85D2C]/40 hover:-translate-y-0.5 transition-all gap-2">
              <Upload className="w-4 h-4" />
              Upload First Song
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
