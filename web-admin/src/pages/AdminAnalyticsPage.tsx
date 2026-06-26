import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { http } from "../services/http";
import ErrorBoundary from "../components/ErrorBoundary";
import PageWrapper from "../components/PageWrapper";
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
  Download,
  Music,
  User,
  Activity,
  Zap,
  Crown,
  Award,
  BarChart3,
  PieChart,
  LineChart as LineChartIcon,
} from "lucide-react";

type GlobalSummary = {
  success: boolean;
  totalRevenue: number;
  platformFee: number;
  artistPayouts: number;
  totalArtists: number;
  totalFans: number;
  totalActiveUsers: number;
  userGrowthRatePct: number;
};

type SeriesPoint = { date: string; value: number };

type RevenueTrendsResponse = { success: boolean; data: SeriesPoint[] };

type TopArtist = {
  artistId: number;
  name: string | null;
  profileImageUrl: string | null;
  subscribers: number;
  plays: number;
};

type TopArtistsResponse = { success: boolean; items: TopArtist[] };

function formatCurrency(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₹0.00";
  return (
    "₹" +
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatCompact(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString();
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = "orange",
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: string;
  color?: "orange" | "purple" | "green" | "blue";
  subtitle?: string;
}) {
  const colorMap = {
    orange: "from-[#E85D2C] to-[#C97A54]",
    purple: "from-[#8B5CF6] to-[#6D28D9]",
    green: "from-[#10B981] to-[#059669]",
    blue: "from-[#3B82F6] to-[#2563EB]",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6 hover:border-white/10 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[#8D7B77]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white tracking-tight">
            {value}
          </p>

          {subtitle && (
            <p className="mt-1 text-sm text-[#8D7B77]">{subtitle}</p>
          )}

          {trend && trendValue && (
            <div className="mt-3 flex items-center gap-1.5">
              {trend === "up" ? (
                <ArrowUpRight size={16} className="text-green-400" />
              ) : (
                <ArrowDownRight size={16} className="text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend === "up" ? "text-green-400" : "text-red-400"
                }`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>

        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${colorMap[color]} opacity-80 group-hover:opacity-100 transition-opacity`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [global, setGlobal] = useState<GlobalSummary | null>(null);
  const [revenue, setRevenue] = useState<SeriesPoint[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [subMetrics, setSubMetrics] = useState<any>(null);

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState<string>(
    formatDateForInput(defaultRange.start)
  );
  const [endDate, setEndDate] = useState<string>(
    formatDateForInput(defaultRange.end)
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = `?startDate=${encodeURIComponent(
        startDate
      )}&endDate=${encodeURIComponent(endDate)}`;

      const [g, r, a, m] = await Promise.all([
        http.get<GlobalSummary>(
          `/api/v1/admin/analytics/global-summary${dateParams}`
        ),
        http.get<RevenueTrendsResponse>(
          `/api/v1/admin/analytics/revenue-trends${dateParams}`
        ),
        http.get<TopArtistsResponse>("/api/v1/admin/analytics/top-artists"),
        http.get<any>("/api/v1/admin/analytics/metrics"),
      ]);

      setGlobal(g.data);
      setRevenue((r.data?.data ?? []) as SeriesPoint[]);
      setTopArtists((a.data?.items ?? []) as TopArtist[]);
      setSubMetrics(m.data?.metrics);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin/login", { replace: true });
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRevenue = global?.totalRevenue ?? 0;
  const platformFee = global?.platformFee ?? totalRevenue * 0.1;
  const artistPayouts = global?.artistPayouts ?? totalRevenue * 0.9;

  const revenueChartData = revenue.map((p) => ({
    name: p.date.slice(5),
    value: p.value,
  }));

  const stats = [
    {
      title: "Total Revenue",
      value: loading ? "..." : formatCurrency(totalRevenue),
      icon: DollarSign,
      trend: "up" as const,
      trendValue: "12.5%",
      color: "orange" as const,
      subtitle: `${formatCompact(global?.totalActiveUsers ?? 0)} active users`,
    },
    {
      title: "Total Artists",
      value: loading ? "..." : formatCompact(global?.totalArtists ?? 0),
      icon: Users,
      trend: "up" as const,
      trendValue: "8.2%",
      color: "purple" as const,
    },
    {
      title: "Total Fans",
      value: loading ? "..." : formatCompact(global?.totalFans ?? 0),
      icon: Users,
      trend: "up" as const,
      trendValue: "5.7%",
      color: "green" as const,
    },
    {
      title: "Conversion Rate",
      value: loading ? "..." : subMetrics?.conversionRate || "0%",
      icon: TrendingUp,
      trend: "up" as const,
      trendValue: "3.1%",
      color: "blue" as const,
      subtitle: "Subscribers vs Total Fans",
    },
  ];

  return (
    <PageWrapper
      title="Analytics"
      subtitle="Track your platform's performance metrics">
      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
          <Calendar size={16} className="text-[#8D7B77]" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-white text-sm outline-none cursor-pointer"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <span className="text-[#8D7B77]">to</span>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
          <Calendar size={16} className="text-[#8D7B77]" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-white text-sm outline-none cursor-pointer"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E85D2C] text-white text-sm font-medium hover:bg-[#C97A54] transition-all disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Apply
        </button>
        <button
          onClick={() => {
            const defaultRange = getDefaultDateRange();
            setStartDate(formatDateForInput(defaultRange.start));
            setEndDate(formatDateForInput(defaultRange.end));
          }}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white hover:bg-white/10 transition-all">
          Reset
        </button>
        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
          }}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white hover:bg-white/10 transition-all">
          All Time
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#E85D2C]/10">
                <LineChartIcon size={20} className="text-[#E85D2C]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#8D7B77]">
                  Revenue Growth
                </h3>
                <p className="text-2xl font-bold text-white mt-0.5">
                  {loading
                    ? "..."
                    : formatCurrency(
                        revenue.reduce((acc, curr) => acc + curr.value, 0)
                      )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#8D7B77]">
              <Clock size={14} />
              <span>Last {revenue.length} days</span>
            </div>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={revenueChartData}
                margin={{ top: 5, right: 5, left: -5, bottom: 5 }}>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.03)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#8D7B77", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8D7B77", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#15100E",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                  labelStyle={{ color: "#8D7B77" }}
                  itemStyle={{ color: "#FFFFFF" }}
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#E85D2C"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#E85D2C", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#E85D2C", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-6 text-sm">
            <div>
              <span className="text-[#8D7B77]">Artist Payouts: </span>
              <span className="text-white font-medium">
                {loading ? "..." : formatCurrency(artistPayouts)}
              </span>
            </div>
            <div>
              <span className="text-[#8D7B77]">Platform Fee: </span>
              <span className="text-white font-medium">
                {loading ? "..." : formatCurrency(platformFee)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Artists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Artists */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Crown size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#8D7B77]">
                  Top Performing Artists
                </h3>
                <p className="text-lg font-bold text-white mt-0.5">
                  {loading
                    ? "..."
                    : `${subMetrics?.revenuePerArtist?.length || 0} artists`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#8D7B77]">
              <TrendingUp size={14} />
              <span>By Revenue</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
                    <div className="h-4 w-32 bg-white/5 animate-pulse rounded" />
                  </div>
                  <div className="h-4 w-20 bg-white/5 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : subMetrics?.revenuePerArtist?.length ? (
            <div className="space-y-2">
              {subMetrics.revenuePerArtist.map((a: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-1.5 h-8 rounded-full ${
                        i === 0
                          ? "bg-[#E85D2C]"
                          : i === 1
                          ? "bg-purple-400"
                          : "bg-blue-400"
                      }`}
                    />
                    <span className="text-sm text-white truncate">
                      {a.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-[#E85D2C]">
                    {formatCurrency(a.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[#8D7B77]">
                No revenue data available
              </p>
            </div>
          )}
        </div>

        {/* Popular Artists (Activity) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Activity size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#8D7B77]">
                  Popular Artists
                </h3>
                <p className="text-lg font-bold text-white mt-0.5">
                  {loading ? "..." : `${topArtists.length} artists`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#8D7B77]">
              <Music size={14} />
              <span>Subscribers + Plays</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/5 animate-pulse" />
                    <div>
                      <div className="h-4 w-32 bg-white/5 animate-pulse rounded" />
                      <div className="h-3 w-20 bg-white/5 animate-pulse rounded mt-1" />
                    </div>
                  </div>
                  <div className="h-4 w-16 bg-white/5 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : topArtists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#8D7B77]">No data available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topArtists.map((a) => (
                <div
                  key={a.artistId}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-black/30 border border-white/10 overflow-hidden shrink-0">
                      {a.profileImageUrl ? (
                        <img
                          src={a.profileImageUrl}
                          alt={a.name ?? String(a.artistId)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#8D7B77]">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">
                        {a.name ?? "Unnamed Artist"}
                      </div>
                      <div className="text-xs text-[#8D7B77]">
                        {formatCompact(a.subscribers)} subscribers
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-blue-400">
                    {formatCompact(a.plays)} plays
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
