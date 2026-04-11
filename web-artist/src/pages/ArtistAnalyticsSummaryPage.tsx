import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine
} from "recharts";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";

import ErrorBoundary from "../components/ErrorBoundary";
import Skeleton from "../components/Skeleton";

type MetricType = "plays" | "earnings";
type TimeFilter = 7 | 30 | 90 | 365;

function CustomTooltip({ active, payload, label, metric, growth }: any) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const formattedVal =
      metric === "earnings"
        ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val)
        : new Intl.NumberFormat("en-IN").format(val);
    
    const prevValue = payload[0].payload.prevValue;
    const change = prevValue !== undefined ? val - prevValue : 0;
    const percentChange = prevValue > 0 ? ((change / prevValue) * 100).toFixed(1) : '0';
    const isPositive = change >= 0;

    return (
      <div className="bg-[#1a1412]/98 border border-[#c97a54]/30 rounded-xl p-4 shadow-2xl backdrop-blur-xl">
        <p className="text-[#a99792] text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-white text-2xl font-bold">{formattedVal}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(Number(percentChange))}%
          </span>
        </div>
        <p className="text-[#8d7b77] text-xs">
          {metric === "earnings" ? "Earnings" : "Plays"} vs previous day
        </p>
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
    if (!Number.isFinite(v)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v);
  };

  const formatCompact = (n: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString();
  };

  const growthChartData = useMemo(() => {
    return growth.map((p: any, idx: number) => ({
      name: p.date.slice(5),
      value: p.value,
      prevValue: idx > 0 ? growth[idx - 1].value : p.value,
      fullDate: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }));
  }, [growth]);

  // Calculate stats
  const chartStats = useMemo(() => {
    if (!growth.length) return { total: 0, avg: 0, max: 0, trend: 0 };
    const values = growth.map((g: any) => g.value);
    const total = values.reduce((a: number, b: number) => a + b, 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;
    const trend = first > 0 ? ((last - first) / first) * 100 : 0;
    return { total, avg: Math.round(avg), max, trend };
  }, [growth]);

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

        {/* Enhanced Performance Trend Card */}
        <div className="mb-8">
          <ErrorBoundary label="Artist Analytics: Growth Chart">
            <div className="rounded-[20px] border border-[#c97a54]/20 bg-gradient-to-br from-[#1a1412] via-[#141010] to-[#1a1412] p-6 sm:p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">
              {/* Ambient glow effect */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#c97a54]/5 rounded-full blur-[100px] pointer-events-none" />
              
              {/* Header */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[#c97a54]/20 flex items-center justify-center border border-[#c97a54]/30">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c97a54" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18"/>
                        <path d="M18 17V9"/>
                        <path d="M13 17V5"/>
                        <path d="M8 17v-3"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-white">Performance Trend</h3>
                      <p className="text-[13px] text-[#a99792]">Track your {metricFilter === 'earnings' ? 'revenue' : 'plays'} growth over time</p>
                    </div>
                  </div>
                </div>
                
                {/* Time Range Pills */}
                <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/5">
                  {[
                    { val: 7, label: '7D' },
                    { val: 30, label: '30D' },
                    { val: 90, label: '3M' },
                    { val: 365, label: '1Y' }
                  ].map((t) => (
                    <button
                      key={t.val}
                      onClick={() => setTimeFilter(t.val as TimeFilter)}
                      className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-200 ${
                        timeFilter === t.val 
                          ? 'bg-[#c97a54] text-white shadow-lg shadow-[#c97a54]/25' 
                          : 'text-[#8d7b77] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats Cards */}
              {!loading && !isEmpty && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 relative z-10">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#a99792] text-xs uppercase tracking-wider mb-1">Total {metricFilter === 'earnings' ? 'Revenue' : 'Plays'}</p>
                    <p className="text-white text-xl font-bold">
                      {metricFilter === 'earnings' 
                        ? formatCurrency(chartStats.total)
                        : formatCompact(chartStats.total)
                      }
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#a99792] text-xs uppercase tracking-wider mb-1">Daily Average</p>
                    <p className="text-white text-xl font-bold">
                      {metricFilter === 'earnings'
                        ? formatCurrency(chartStats.avg)
                        : formatCompact(chartStats.avg)
                      }
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#a99792] text-xs uppercase tracking-wider mb-1">Peak Day</p>
                    <p className="text-white text-xl font-bold">
                      {metricFilter === 'earnings'
                        ? formatCurrency(chartStats.max)
                        : formatCompact(chartStats.max)
                      }
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#a99792] text-xs uppercase tracking-wider mb-1">Trend</p>
                    <div className="flex items-center gap-1">
                      <span className={`text-xl font-bold ${chartStats.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {chartStats.trend >= 0 ? '↑' : '↓'} {Math.abs(chartStats.trend).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Metric Toggle */}
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <span className="text-[#8d7b77] text-sm font-medium">Show:</span>
                <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                  {(["plays", "earnings"] as MetricType[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetricFilter(m)}
                      className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium capitalize rounded-md transition-all ${
                        metricFilter === m 
                          ? "bg-[#c97a54] text-white shadow-lg" 
                          : "text-[#8d7b77] hover:text-[#e6d6d2]"
                      }`}
                    >
                      {m === 'plays' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                      )}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Area */}
              <div className={`h-[320px] relative z-10 transition-opacity duration-300 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                {loading ? (
                  <div className="h-full w-full flex flex-col justify-end pb-8 gap-4 px-12">
                     <Skeleton className="h-[50%] w-full rounded-t-xl" />
                     <div className="flex justify-between w-full">
                       <Skeleton className="h-4 w-12" />
                       <Skeleton className="h-4 w-12" />
                       <Skeleton className="h-4 w-12" />
                       <Skeleton className="h-4 w-12" />
                     </div>
                  </div>
                ) : isEmpty ? (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#c97a54]/10 flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c97a54" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <p className="text-white font-medium mb-1">No data yet</p>
                    <p className="text-[#8d7b77] text-sm">Start creating content to see your performance trend!</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthChartData} margin={{ left: 0, right: 20, top: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAnalyticsMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c97a54" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="#c97a54" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#c97a54" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={true} horizontal={true} strokeDasharray="0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: "#8d7b77", fontSize: 12, fontWeight: 500 }} 
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                        minTickGap={40}
                        dy={10}
                      />
                      <YAxis 
                        tick={{ fill: "#8d7b77", fontSize: 12, fontWeight: 500 }} 
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                        tickFormatter={(val) => {
                           if (val >= 1000 && metricFilter !== 'earnings') return `${(val/1000).toFixed(1)}k`;
                           if (metricFilter === 'earnings') return `₹${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`;
                           return val;
                        }}
                      />
                      <Tooltip 
                        content={<CustomTooltip metric={metricFilter} />} 
                        cursor={{ stroke: '#c97a54', strokeWidth: 1, strokeDasharray: '4 4' }} 
                      />
                      <ReferenceLine y={chartStats.avg} stroke="#c97a54" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#c97a54" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorAnalyticsMetric)" 
                        activeDot={{ 
                          r: 8, 
                          fill: "#c97a54", 
                          stroke: "#fff", 
                          strokeWidth: 3,
                          fillOpacity: 1
                        }}
                        dot={{ r: 4, fill: "#c97a54", stroke: "#1a1412", strokeWidth: 2 }}
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              
              {/* Legend */}
              {!loading && !isEmpty && (
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#c97a54]" />
                    <span className="text-[#8d7b77] text-xs">{metricFilter === 'earnings' ? 'Daily Earnings' : 'Daily Plays'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0 border-t border-dashed border-[#c97a54] opacity-50" />
                    <span className="text-[#8d7b77] text-xs">Average</span>
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>
        </div>


      </div>
    </div>
  );
}
