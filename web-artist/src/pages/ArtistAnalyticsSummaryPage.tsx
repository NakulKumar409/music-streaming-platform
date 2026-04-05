import { useMemo, useState } from "react";
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

type MetricType = "plays" | "earnings";
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
        <p className="text-white text-lg font-bold">{formattedVal}</p>
      </div>
    );
  }
  return null;
}

export default function ArtistAnalyticsSummaryPage() {
  const [metricFilter, setMetricFilter] = useState<MetricType>("plays");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(30);

  const analyticsQuery = useQuery({
    queryKey: ["artist", "analytics", metricFilter, timeFilter],
    queryFn: async () => {
      const [sRes, gRes, cpRes] = await Promise.all([
        http.get("/api/v1/artist/dashboard/summary"),
        http.get(`/api/v1/artist/dashboard/growth?days=${timeFilter}&metric=${metricFilter}`),
        http.get(`/api/v1/artist/analytics/content-performance?days=${timeFilter}`)
      ]);

      return {
        stats: sRes.data?.stats ?? null,
        growth: Array.isArray(gRes.data?.data) ? gRes.data.data : [],
        growthTotal: gRes.data?.total ?? 0,
        contentPerformance: Array.isArray(cpRes.data?.items) ? cpRes.data.items : []
      };
    }
  });

  const loading = analyticsQuery.isLoading;
  const isFetching = analyticsQuery.isFetching;
  
  const stats = analyticsQuery.data?.stats ?? null;
  const growth = analyticsQuery.data?.growth ?? [];
  const contentPerformance = analyticsQuery.data?.contentPerformance ?? [];

  const isEmpty = !loading && stats && stats.totalPlays === 0 && stats.subscribers === 0;

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 35% 15%, rgba(193,117,86,0.12) 0%, rgba(25,18,18,0.58) 48%, rgba(10,8,8,0.92) 100%)"
    } as const;
  }, []);

  const formatCurrency = (amount: number) => {
    const v = Number(amount);
    if (!Number.isFinite(v)) return "$0.00";
    return v.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatCompact = (n: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString();
  };

  const growthChartData = useMemo(() => growth.map((p: any) => ({
    name: p.date.slice(5),
    value: p.value
  })), [growth]);

  const bestSong = contentPerformance.length > 0 ? contentPerformance[0] : null;


  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-[16px] border border-white/10 bg-[#141010]/35 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]" style={backgroundStyle}>
      <div className="relative px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-10">
        
        {/* Header Section */}
        <div className="mb-10">
          <h2 className="text-3xl font-light tracking-wide text-white mb-2 flex items-center gap-2">Analytics Overview 📊</h2>
          <p className="text-[#a99792] text-sm md:text-base max-w-xl">Understand how your music is performing and gaining traction over time across different metrics.</p>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="mb-10 rounded-[16px] border border-dashed border-white/20 bg-black/40 p-12 flex flex-col items-center text-center shadow-xl">
             <div className="text-5xl mb-4 opacity-50">🧭</div>
             <h3 className="text-2xl font-bold tracking-wide text-white mb-2">No analytics yet</h3>
             <p className="text-[#a99792] text-[15px] max-w-md">Upload your first song to start tracking your performance. Once fans start listening and engaging, your data will naturally flow right here.</p>
          </div>
        )}

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="rounded-[16px] border border-white/10 bg-gradient-to-br from-[#1e1513] to-[#0e0a0a] px-6 py-6 shadow-lg shadow-black/50 transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-[12px] uppercase tracking-widest text-[#8d7b77] font-semibold">
                <div className="h-[30px] w-[30px] rounded-[10px] bg-[#c97a54]/10 border border-[#c97a54]/20 flex items-center justify-center text-[#c97a54]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 3l14 9-14 9V3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                Total Plays
              </div>
              {stats?.totalPlays > 0 && <span className="text-emerald-400 text-[11px] font-bold bg-emerald-400/10 px-2 py-1 rounded-full flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg> Up</span>}
            </div>
            <div className="text-[36px] font-light tracking-tight text-white mb-1">
              {loading ? <Skeleton className="h-[40px] w-[100px]" /> : formatCompact(stats?.totalPlays ?? 0)}
            </div>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-gradient-to-br from-[#1e1513] to-[#0e0a0a] px-6 py-6 shadow-lg shadow-black/50 transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-[12px] uppercase tracking-widest text-[#8d7b77] font-semibold">
                <div className="h-[30px] w-[30px] rounded-[10px] bg-[#c97a54]/10 border border-[#c97a54]/20 flex items-center justify-center text-[#c97a54]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                Total Earnings
              </div>
              {stats?.grossEarnings > 0 && <span className="text-emerald-400 text-[11px] font-bold bg-emerald-400/10 px-2 py-1 rounded-full flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg> Up</span>}
            </div>
            <div className="text-[36px] font-light tracking-tight text-white mb-1 whitespace-nowrap">
              {loading ? <Skeleton className="h-[40px] w-[140px]" /> : formatCurrency(stats?.grossEarnings ?? 0)}
            </div>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-gradient-to-br from-[#1e1513] to-[#0e0a0a] px-6 py-6 shadow-lg shadow-black/50 transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-[12px] uppercase tracking-widest text-[#8d7b77] font-semibold">
                <div className="h-[30px] w-[30px] rounded-[10px] bg-[#c97a54]/10 border border-[#c97a54]/20 flex items-center justify-center text-[#c97a54]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                Subscribers
              </div>
              {stats?.subscribers > 0 && <span className="text-emerald-400 text-[11px] font-bold bg-emerald-400/10 px-2 py-1 rounded-full flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg> Up</span>}
            </div>
            <div className="text-[36px] font-light tracking-tight text-white mb-1">
              {loading ? <Skeleton className="h-[40px] w-[80px]" /> : formatCompact(stats?.subscribers ?? 0)}
            </div>
          </div>
        </div>

        {/* Smart Insights Banner */}
        {!isEmpty && !loading && (
          <div className="mb-8 rounded-[12px] border border-[#c97a54]/20 bg-gradient-to-r from-[#c97a54]/10 to-[#141010]/35 p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner tracking-wide">
             <div className="flex items-center gap-4">
               <div className="h-10 w-10 min-w-[40px] rounded-full bg-[#c97a54]/20 text-[#c97a54] flex items-center justify-center text-xl border border-[#c97a54]/30">🌟</div>
               <div>
                  <h4 className="text-white font-medium mb-1">Smart Insight</h4>
                  <p className="text-[#b8a6a1] text-sm">
                    {bestSong 
                      ? <>Your best performing song right now is <span className="text-white font-semibold">"{bestSong.title}"</span> with {formatCompact(bestSong.plays)} total plays.</>
                      : <>Keep uploading consistently to unlock deeper insights into your audience!</>
                    }
                  </p>
               </div>
             </div>
          </div>
        )}

        {/* Main Interactive Graph */}
        <div className="mb-8">
          <ErrorBoundary label="Artist Analytics: Growth Chart">
            <div className="rounded-[16px] border border-white/5 bg-[#141010]/50 p-6 sm:p-8 shadow-2xl backdrop-blur-sm relative h-[450px] flex flex-col">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white mb-1">Performance Trend</h3>
                  <p className="text-[13px] text-[#a99792]">This graph shows your performance over time.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                    {(["plays", "earnings"] as MetricType[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetricFilter(m)}
                        className={`px-4 py-1.5 text-[13px] font-medium capitalize rounded-md transition-all ${metricFilter === m ? "bg-[#c97a54] text-white shadow-lg" : "text-[#8d7b77] hover:text-[#e6d6d2]"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
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

              <div className={`flex-1 w-full relative transition-opacity duration-300 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                {loading ? (
                  <div className="h-full w-full flex flex-col justify-end pb-8 gap-4 px-12">
                     <Skeleton className="h-[40%] w-full rounded-t-xl" />
                     <div className="flex justify-between w-full">
                       <Skeleton className="h-4 w-10" />
                       <Skeleton className="h-4 w-10" />
                       <Skeleton className="h-4 w-10" />
                       <Skeleton className="h-4 w-10" />
                     </div>
                  </div>
                ) : isEmpty ? (
                  <div className="h-full w-full flex items-center justify-center">
                      <p className="text-[#8d7b77] text-sm">Waiting for performance data to populate</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthChartData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAnalyticsMetric" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#colorAnalyticsMetric)" 
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
    </div>
  );
}
