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
  YAxis
} from "recharts";
import { http } from "../services/http";
import ErrorBoundary from "../components/ErrorBoundary";

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

function formatCurrency(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₹0.00";
  return "₹" + n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCompact(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString();
}

function StatCard({
  title,
  value,
  sub,
  accent
}: {
  title: string;
  value: string;
  sub?: string;
  accent: "purple" | "brown" | "orange";
}) {
  const accentColor =
    accent === "purple"
      ? "text-[#9a6bb1]"
      : accent === "orange"
        ? "text-[#c9853b]"
        : "text-[#b16e5b]";

  return (
    <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
      <div className="relative px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#8d7b77]">{title}</div>
            <div className="mt-2 text-[28px] leading-[30px] font-light tracking-wide text-[#e6d6d2]">
              {value}
            </div>
            {sub ? <div className="mt-2 text-[12px] text-[#a99792]">{sub}</div> : null}
          </div>
          <div className={`mt-1 ${accentColor}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2V22"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M17 6H9.5C7.01472 6 5 8.01472 5 10.5C5 12.9853 7.01472 15 9.5 15H14.5C16.9853 15 19 17.0147 19 19.5C19 21.9853 16.9853 24 14.5 24H6"
                stroke="currentColor"
                strokeWidth="0"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30); // Default to last 30 days
  return { start, end };
}

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [global, setGlobal] = useState<GlobalSummary | null>(null);
  const [revenue, setRevenue] = useState<SeriesPoint[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [subMetrics, setSubMetrics] = useState<any>(null);
  
  // Date range state
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState<string>(formatDateForInput(defaultRange.start));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(defaultRange.end));

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_77cf67.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      
      const [g, r, a, m] = await Promise.all([
        http.get<GlobalSummary>(`/api/v1/admin/analytics/global-summary${dateParams}`),
        http.get<RevenueTrendsResponse>(`/api/v1/admin/analytics/revenue-trends${dateParams}`),
        http.get<TopArtistsResponse>("/api/v1/admin/analytics/top-artists"),
        http.get<any>("/api/v1/admin/analytics/metrics")
      ]);

      setGlobal(g.data);
      setRevenue((r.data?.data ?? []) as SeriesPoint[]);
      setTopArtists((a.data?.items ?? []) as TopArtist[]);
      setSubMetrics(m.data?.metrics);
      
      // Debug: Log metrics data
      console.log("[FRONTEND DEBUG] Metrics response:", m.data);
      console.log("[FRONTEND DEBUG] Metrics object:", m.data?.metrics);
      console.log("[FRONTEND DEBUG] Conversion rate:", m.data?.metrics?.conversionRate);
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
    value: p.value
  }));


  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
          <div className="hidden">
            <PremiumPlayLogo />
          </div>

          <div className="mt-10 text-[40px] leading-[44px] font-light tracking-wide text-[#e0c7c0]">
            Analytics
          </div>

          <div className="mt-2 text-[13px] text-[#b8a6a1]">
            {loading
              ? "Loading global metrics..."
              : `User growth (last 30 days): ${Number(global?.userGrowthRatePct ?? 0).toFixed(2)}%`}
          </div>

          {/* Date Range Selector */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-[#1a1414]/60 border border-white/10 rounded-lg px-4 py-2">
              <label className="text-[12px] text-[#8d7b77] uppercase tracking-wider">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-[#e6d6d2] text-[14px] outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="flex items-center gap-2 bg-[#1a1414]/60 border border-white/10 rounded-lg px-4 py-2">
              <label className="text-[12px] text-[#8d7b77] uppercase tracking-wider">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-[#e6d6d2] text-[14px] outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-[#c9853b] hover:bg-[#b8742a] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
            <button
              onClick={() => {
                const defaultRange = getDefaultDateRange();
                setStartDate(formatDateForInput(defaultRange.start));
                setEndDate(formatDateForInput(defaultRange.end));
              }}
              className="px-4 py-2 bg-transparent border border-white/20 hover:bg-white/10 text-[#b8a6a1] text-[13px] rounded-lg transition-colors"
            >
              Reset to Last 30 Days
            </button>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 bg-transparent border border-white/20 hover:bg-white/10 text-[#b8a6a1] text-[13px] rounded-lg transition-colors"
            >
              All Time
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Platform Revenue"
              value={loading ? "—" : formatCurrency(totalRevenue)}
              sub={loading ? undefined : "Total money processed"}
              accent="brown"
            />
            <StatCard
              title="Total Fans"
              value={loading ? "—" : formatCompact(global?.totalFans ?? 0)}
              accent="purple"
            />
            <StatCard
              title="Active Subscribers"
              value={loading ? "—" : formatCompact(subMetrics?.activeSubscribers ?? 0)}
              sub="Platform plan subscribers"
              accent="brown"
            />
            <StatCard
              title="Total Artists"
              value={loading ? "—" : formatCompact(global?.totalArtists ?? 0)}
              accent="purple"
            />
            <StatCard
              title="Conversion Rate"
              value={loading ? "—" : (subMetrics?.conversionRate || "0%")}
              sub="Subs vs Total Fans"
              accent="orange"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <ErrorBoundary label="Admin Analytics: Revenue Chart">
              <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
              <div className="relative px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Monthly Revenue Growth</div>
                  <div className="text-[12px] text-[#8d7b77]">Last 30 days</div>
                </div>

                <div className="mt-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData} margin={{ left: 8, right: 18, top: 10, bottom: 10 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#a99792", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#a99792", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(20,16,16,0.92)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 8,
                          color: "#e6d6d2"
                        }}
                        formatter={(v: any) => formatCurrency(Number(v) || 0)}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#c9853b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 text-[12px] text-[#8d7b77]">
                  Artist payouts: {loading ? "—" : formatCurrency(artistPayouts)}
                </div>
              </div>
              </div>
            </ErrorBoundary>

          </div>

          <div className="mt-4 relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            <div className="relative px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-[14px] tracking-wide text-[#e6d6d2]">Top Performing Artists</div>
                <div className="text-[12px] text-[#8d7b77]">Direct Revenue</div>
              </div>

              <div className="mt-4">
                {loading ? (
                  <div className="text-[13px] text-[#a99792]">Loading...</div>
                ) : !subMetrics?.revenuePerArtist?.length ? (
                  <div className="text-[13px] text-[#a99792]">No revenue data yet.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {subMetrics.revenuePerArtist.map((a: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-[6px] border border-white/5 bg-[#141010]/35 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                           <div className="h-[8px] w-[8px] rounded-full bg-[#c9853b]" />
                           <div className="text-[13px] text-[#e6d6d2] truncate">{a.name}</div>
                        </div>
                        <div className="text-[12px] text-[#cdbdb8] font-bold">{formatCurrency(a.revenue)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            <div className="relative px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-[14px] tracking-wide text-[#e6d6d2]">Popular Artists (Activity)</div>
                <div className="text-[12px] text-[#8d7b77]">Subscribers + Plays</div>
              </div>

              <div className="mt-4">
                {loading ? (
                  <div className="text-[13px] text-[#a99792]">Loading...</div>
                ) : topArtists.length === 0 ? (
                  <div className="text-[13px] text-[#a99792]">No data yet.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {topArtists.map((a) => (
                      <div
                        key={a.artistId}
                        className="flex items-center justify-between rounded-[6px] border border-white/5 bg-[#141010]/35 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-[34px] w-[34px] rounded-full bg-[#2a1c1c] border border-white/10 overflow-hidden">
                            {a.profileImageUrl ? (
                              <img
                                src={a.profileImageUrl}
                                alt={a.name ?? String(a.artistId)}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] text-[#e6d6d2] truncate">{a.name ?? "(Unnamed)"}</div>
                            <div className="text-[12px] text-[#8d7b77]">
                              {formatCompact(a.subscribers)} subscribers
                            </div>
                          </div>
                        </div>
                        <div className="text-[12px] text-[#cdbdb8]">{formatCompact(a.plays)} plays</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
