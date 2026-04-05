import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";

import ErrorBoundary from "../components/ErrorBoundary";
import Skeleton from "../components/Skeleton";

type MetricType = "plays" | "earnings" | "subscribers";
type TimeFilter = 7 | 30 | 90 | 365;

function CustomTooltip({ active, payload, label, metric }: any) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const formattedVal =
      metric === "earnings"
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val)
        : new Intl.NumberFormat("en-US").format(val);

    return (
      <div className="bg-[#141010]/95 border border-white/10 rounded-lg p-3 shadow-xl backdrop-blur-md">
        <p className="text-[#a99792] text-xs font-medium uppercase font-mono tracking-wider mb-1">{label}</p>
        <p className="text-white text-lg font-bold">
          {formattedVal}
        </p>
      </div>
    );
  }
  return null;
}

export default function ArtistDashboardPage() {
  const [metricFilter, setMetricFilter] = useState<MetricType>("plays");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(30);

  const dashboardQuery = useQuery({
    queryKey: ["artist", "dashboard", metricFilter, timeFilter],
    queryFn: async () => {
      const [s, g] = await Promise.all([
        http.get("/api/v1/artist/dashboard/summary"),
        http.get(`/api/v1/artist/dashboard/growth?days=${timeFilter}&metric=${metricFilter}`)
      ]);

      return {
        stats: s.data?.stats ?? null,
        growth: Array.isArray(g.data?.data) ? g.data.data : [],
        growthTotal: g.data?.total ?? 0
      };
    }
  });

  const loading = dashboardQuery.isLoading;
  const isFetching = dashboardQuery.isFetching;
  const stats = dashboardQuery.data?.stats ?? null;
  const growth = dashboardQuery.data?.growth ?? [];
  const growthTotal = dashboardQuery.data?.growthTotal ?? 0;

  const isFirstTimeUser = !loading && stats && stats.subscribers === 0 && stats.totalPlays === 0;

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 35% 15%, rgba(193,117,86,0.10) 0%, rgba(25,18,18,0.55) 48%, rgba(10,8,8,0.92) 100%)"
    } as const;
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "$0.00";
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, []);

  const formatCompact = useCallback((n: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString();
  }, []);

  const growthChartData = useMemo(() => growth.map((p: { date: string; value: number }) => ({
    name: p.date.slice(5),
    value: p.value
  })), [growth]);

  const isEmptyGraph = !loading && growthTotal === 0 && growth.every((p: any) => p.value === 0);

  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)]" style={backgroundStyle}>
      <div className="relative px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        
        {/* Quick Actions / Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-light tracking-wide text-white">Dashboard Overview</h2>
            <p className="text-[#b8a6a1] text-sm mt-1">Manage your content and view analytics</p>
          </div>
          <Link
            to="/artist/content-upload"
            className="inline-flex h-[44px] items-center justify-center rounded-full border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] px-8 text-[14px] font-medium tracking-wide text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)] hover:shadow-[0_15px_30px_rgba(106,53,44,0.4)] transition-all hover:-translate-y-0.5"
          >
            <span className="mr-2">➕</span> Upload New Song
          </Link>
        </div>

        {isFirstTimeUser && (
          <div className="mb-8 rounded-[10px] border border-[#7a3f31]/30 bg-gradient-to-r from-[#211210] to-[#141010]/35 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
            <div className="flex items-center gap-6">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#c97a54] to-[#7d4a41] flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(201,122,84,0.3)]">
                🚀
              </div>
              <div>
                <h3 className="text-xl font-medium tracking-wide text-white mb-1">Welcome to your new Artist Studio!</h3>
                <p className="text-[#b8a6a1] text-sm max-w-lg leading-relaxed">
                  You're all set to start building your audience. Your dashboard is a bit quiet right now. Let's fix that by releasing your first track to the world.
                </p>
              </div>
            </div>
            <Link
              to="/artist/content-upload"
              className="whitespace-nowrap inline-flex h-[50px] items-center justify-center rounded-[8px] bg-white text-[#141010] px-8 text-[15px] font-bold tracking-wide shadow-[0_4px_14px_rgba(255,255,255,0.25)] hover:bg-[#f0f0f0] transition-colors"
            >
              Upload First Track
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/25 px-7 py-6 hover:bg-[#0e0a0a]/40 transition-colors">
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-widest text-[#8d7b77]">
              <div className="h-[28px] w-[28px] rounded-[9px] bg-[#141010]/60 border border-white/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>Subscribers</div>
            </div>
            <div className="mt-4 text-[34px] font-light tracking-wide text-[#e6d6d2]">
              {loading ? <Skeleton className="h-[34px] w-[140px]" /> : formatCompact(stats?.subscribers ?? 0)}
            </div>
          </div>

          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/25 px-7 py-6 hover:bg-[#0e0a0a]/40 transition-colors">
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-widest text-[#8d7b77]">
              <div className="h-[28px] w-[28px] rounded-[9px] bg-[#141010]/60 border border-white/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
                </svg>
              </div>
              <div>Total Plays</div>
            </div>
            <div className="mt-4 text-[34px] font-light tracking-wide text-[#e6d6d2]">
              {loading ? <Skeleton className="h-[34px] w-[140px]" /> : formatCompact(stats?.totalPlays ?? 0)}
            </div>
          </div>

          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/25 px-7 py-6 hover:bg-[#0e0a0a]/40 transition-colors">
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-widest text-[#8d7b77]">
              <div className="h-[28px] w-[28px] rounded-[9px] bg-[#141010]/60 border border-white/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1V23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M17 5H9.5C7.01472 5 5 7.01472 5 9.5C5 11.9853 7.01472 14 9.5 14H14.5C16.9853 14 19 16.0147 19 18.5C19 20.9853 16.9853 23 14.5 23H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>Gross Earnings</div>
            </div>
            <div className="mt-4 text-[34px] font-light tracking-wide text-[#e6d6d2]">
              {loading ? <Skeleton className="h-[34px] w-[180px]" /> : formatCurrency(stats?.grossEarnings ?? 0)}
            </div>
          </div>
        </div>

        <ErrorBoundary label="Artist Dashboard: Growth Chart">
          <div className="mt-8 rounded-[12px] border border-white/5 bg-[#141010]/50 p-6 sm:p-8 shadow-2xl backdrop-blur-sm relative">
            
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                  Growth Overview <span className="text-lg">📈</span>
                </h3>
                <p className="text-[14px] text-[#a99792]">This graph shows how your music is performing over time.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Metric Switch */}
                <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                  {(["plays", "earnings", "subscribers"] as MetricType[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetricFilter(m)}
                      className={`px-4 py-1.5 text-[13px] font-medium capitalize rounded-md transition-all ${metricFilter === m ? "bg-[#c97a54] text-white shadow-lg" : "text-[#8d7b77] hover:text-[#e6d6d2]"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Time Filters Dropdown */}
                <div className="relative">
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(Number(e.target.value) as TimeFilter)}
                    className="appearance-none bg-black/40 border border-white/5 rounded-lg text-[#e6d6d2] text-[13px] font-medium py-2 pl-4 pr-10 hover:border-white/10 focus:border-[#c97a54]/50 focus:ring-1 focus:ring-[#c97a54]/50 outline-none transition-all cursor-pointer"
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={90}>Last 3 Months</option>
                    <option value={365}>Last 1 Year</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8d7b77]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Insights above the graph */}
            <div className="mb-6 flex flex-wrap items-end gap-3 px-1">
               <div className="text-sm text-[#b8a6a1] uppercase tracking-wider font-semibold">Total {metricFilter}:</div>
               <div className="text-2xl font-bold text-white leading-none">
                 {loading ? <Skeleton className="h-6 w-20 inline-block mb-1" /> : (
                   metricFilter === 'earnings' ? formatCurrency(growthTotal) : formatCompact(growthTotal)
                 )}
               </div>
               {!loading && growthTotal > 0 && (
                 <div className="flex items-center text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full ml-2">
                   ↑ Trending
                 </div>
               )}
            </div>

            {/* Main Graph Area */}
            <div className={`mt-2 h-[260px] relative transition-opacity duration-300 ${isFetching ? "opacity-50" : "opacity-100"}`}>
              {loading ? (
                <div className="h-full w-full flex flex-col justify-end pb-8 gap-4 px-12">
                   <Skeleton className="h-[40%] w-full rounded-t-xl" />
                   <div className="flex justify-between w-full">
                     <Skeleton className="h-4 w-10" />
                     <Skeleton className="h-4 w-10" />
                     <Skeleton className="h-4 w-10" />
                     <Skeleton className="h-4 w-10" />
                     <Skeleton className="h-4 w-10" />
                   </div>
                </div>
              ) : isEmptyGraph ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-black/20 rounded-xl border border-white/5 border-dashed">
                    <div className="text-4xl mb-3 opacity-60">📭</div>
                    <h4 className="text-white font-medium text-lg mb-1">No data yet</h4>
                    <p className="text-[#a99792] text-sm text-center max-w-xs">Upload your first song and share it to start seeing analytics.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthChartData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c97a54" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#c97a54" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} strokeDasharray="4 4" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: "rgba(230,214,210,0.5)", fontSize: 11 }} 
                      axisLine={false} 
                      tickLine={false} 
                      minTickGap={30}
                    />
                    <YAxis 
                      tick={{ fill: "rgba(230,214,210,0.5)", fontSize: 11 }} 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => {
                         if (val >= 1000 && metricFilter !== 'earnings') return `${(val/1000).toFixed(0)}k`;
                         if (metricFilter === 'earnings') return `$${val}`;
                         return val;
                      }}
                    />
                    <Tooltip content={<CustomTooltip metric={metricFilter} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#c97a54" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorMetric)" 
                      activeDot={{ r: 6, fill: "#c97a54", stroke: "#141010", strokeWidth: 2 }}
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </ErrorBoundary>

      </div>
    </div>
  );
}
