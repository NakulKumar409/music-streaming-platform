// src/pages/ArtistAnalyticsSummaryPage.tsx
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  PlayCircle,
  Sparkles,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Music,
  PieChart,
  LineChart,
  Wallet,
  UserPlus,
  Eye,
} from "lucide-react";

import ErrorBoundary from "../components/ErrorBoundary";
import Skeleton from "../components/Skeleton";

type MetricType = "plays" | "earnings";
type TimeFilter = 7 | 30 | 90 | 365;

function CustomTooltip({ active, payload, label, metric, growth }: any) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const formattedVal =
      metric === "earnings"
        ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
          }).format(val)
        : new Intl.NumberFormat("en-IN").format(val);

    const prevValue = payload[0].payload.prevValue;
    const change = prevValue !== undefined ? val - prevValue : 0;
    const percentChange =
      prevValue > 0 ? ((change / prevValue) * 100).toFixed(1) : "0";
    const isPositive = change >= 0;

    return (
      <div className="bg-background/98 border border-primary/30 rounded-xl p-4 shadow-2xl backdrop-blur-xl">
        <p className="text-[#B8A6A1] text-xs font-medium uppercase tracking-wider mb-2">
          {label}
        </p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-white text-2xl font-bold">{formattedVal}</span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-rose-500/20 text-rose-400"
            }`}>
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3 inline" />
            ) : (
              <ArrowDownRight className="w-3 h-3 inline" />
            )}
            {Math.abs(Number(percentChange))}%
          </span>
        </div>
        <p className="text-[#8D7B77] text-xs">
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
        http.get(
          `/api/v1/artist/dashboard/growth?days=${timeFilter}&metric=${metricFilter}`
        ),
        http.get(
          `/api/v1/artist/analytics/content-performance?days=${timeFilter}`
        ),
      ]);

      return {
        stats: sRes.data?.stats ?? null,
        growth: Array.isArray(gRes.data?.data) ? gRes.data.data : [],
        growthTotal: gRes.data?.total ?? 0,
        contentPerformance: Array.isArray(cpRes.data?.items)
          ? cpRes.data.items
          : [],
      };
    },
  });

  const loading = analyticsQuery.isLoading;
  const isFetching = analyticsQuery.isFetching;

  const stats = analyticsQuery.data?.stats ?? null;
  const growth = analyticsQuery.data?.growth ?? [];
  const contentPerformance = analyticsQuery.data?.contentPerformance ?? [];

  const isEmpty =
    !loading && stats && stats.totalPlays === 0 && stats.subscribers === 0;

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 35% 15%, rgba(232,93,44,0.06) 0%, rgba(10,10,10,0.95) 100%)",
    } as const;
  }, []);

  const formatCurrency = (amount: number) => {
    const v = Number(amount);
    if (!Number.isFinite(v)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
      fullDate: new Date(p.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }));
  }, [growth]);

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
    <div
      className="relative min-h-[500px] overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl"
      style={backgroundStyle}>
      <div className="relative px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-10">
        {/* Header Section */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            Analytics Overview
          </h2>
          <p className="text-sm text-[#B8A6A1] max-w-xl">
            Understand how your music is performing and gaining traction over
            time across different metrics.
          </p>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="mb-10 rounded-2xl border border-dashed border-white/10 bg-background/60 p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <PieChart className="w-10 h-10 text-primary opacity-50" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              No analytics yet
            </h3>
            <p className="text-[#B8A6A1] text-sm max-w-md">
              Upload your first song to start tracking your performance. Once
              fans start listening and engaging, your data will naturally flow
              right here.
            </p>
          </div>
        )}

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-white/10 bg-surface p-6 hover:border-primary/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PlayCircle className="w-4 h-4 text-primary" />
                </div>
                Total Plays
              </div>
              {stats?.totalPlays > 0 && (
                <span className="text-emerald-400 text-xs font-medium bg-emerald-400/10 px-2 py-1 rounded-full flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Up
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                formatCompact(stats?.totalPlays ?? 0)
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-surface p-6 hover:border-primary/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                Total Earnings
              </div>
              {stats?.grossEarnings > 0 && (
                <span className="text-emerald-400 text-xs font-medium bg-emerald-400/10 px-2 py-1 rounded-full flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Up
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <Skeleton className="h-8 w-[120px]" />
              ) : (
                formatCurrency(stats?.grossEarnings ?? 0)
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-surface p-6 hover:border-primary/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B8A6A1] font-medium">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                Subscribers
              </div>
              {stats?.subscribers > 0 && (
                <span className="text-emerald-400 text-xs font-medium bg-emerald-400/10 px-2 py-1 rounded-full flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Up
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <Skeleton className="h-8 w-[80px]" />
              ) : (
                formatCompact(stats?.subscribers ?? 0)
              )}
            </div>
          </div>
        </div>

        {/* Smart Insights Banner */}
        {!isEmpty && !loading && (
          <div className="mb-8 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-background p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="text-white font-semibold mb-0.5 text-sm">
                  Smart Insight
                </h4>
                <p className="text-[#B8A6A1] text-sm">
                  {bestSong ? (
                    <>
                      Your best performing song right now is{" "}
                      <span className="text-white font-medium">
                        "{bestSong.title}"
                      </span>{" "}
                      with {formatCompact(bestSong.plays)} total plays.
                    </>
                  ) : (
                    <>
                      Keep uploading consistently to unlock deeper insights into
                      your audience!
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Performance Trend Card */}
        <div className="mb-8">
          <ErrorBoundary label="Artist Analytics: Growth Chart">
            <div className="rounded-2xl border border-white/10 bg-surface p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

              {/* Header */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <LineChart className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Performance Trend
                      </h3>
                      <p className="text-sm text-[#B8A6A1]">
                        Track your{" "}
                        {metricFilter === "earnings" ? "revenue" : "plays"}{" "}
                        growth over time
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time Range Pills */}
                <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-white/5">
                  {[
                    { val: 7, label: "7D" },
                    { val: 30, label: "30D" },
                    { val: 90, label: "3M" },
                    { val: 365, label: "1Y" },
                  ].map((t) => (
                    <button
                      key={t.val}
                      onClick={() => setTimeFilter(t.val as TimeFilter)}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                        timeFilter === t.val
                          ? "bg-primary text-white shadow-lg shadow-primary/25"
                          : "text-[#8D7B77] hover:text-white hover:bg-white/5"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats Cards */}
              {!loading && !isEmpty && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 relative z-10">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#B8A6A1] text-xs uppercase tracking-wider mb-1">
                      Total {metricFilter === "earnings" ? "Revenue" : "Plays"}
                    </p>
                    <p className="text-white text-xl font-bold">
                      {metricFilter === "earnings"
                        ? formatCurrency(chartStats.total)
                        : formatCompact(chartStats.total)}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#B8A6A1] text-xs uppercase tracking-wider mb-1">
                      Daily Average
                    </p>
                    <p className="text-white text-xl font-bold">
                      {metricFilter === "earnings"
                        ? formatCurrency(chartStats.avg)
                        : formatCompact(chartStats.avg)}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#B8A6A1] text-xs uppercase tracking-wider mb-1">
                      Peak Day
                    </p>
                    <p className="text-white text-xl font-bold">
                      {metricFilter === "earnings"
                        ? formatCurrency(chartStats.max)
                        : formatCompact(chartStats.max)}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[#B8A6A1] text-xs uppercase tracking-wider mb-1">
                      Trend
                    </p>
                    <div className="flex items-center gap-1">
                      {chartStats.trend >= 0 ? (
                        <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-rose-400" />
                      )}
                      <span
                        className={`text-xl font-bold ${
                          chartStats.trend >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}>
                        {Math.abs(chartStats.trend).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Metric Toggle */}
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <span className="text-[#8D7B77] text-sm font-medium">
                  Show:
                </span>
                <div className="flex p-1 bg-background/60 rounded-lg border border-white/5">
                  {(["plays", "earnings"] as MetricType[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetricFilter(m)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium capitalize rounded-md transition-all ${
                        metricFilter === m
                          ? "bg-primary text-white shadow-lg shadow-primary/25"
                          : "text-[#8D7B77] hover:text-white"
                      }`}>
                      {m === "plays" ? (
                        <PlayCircle className="w-4 h-4" />
                      ) : (
                        <DollarSign className="w-4 h-4" />
                      )}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Area */}
              <div
                className={`h-[320px] relative z-10 transition-opacity duration-300 ${
                  isFetching ? "opacity-50" : "opacity-100"
                }`}>
                {loading ? (
                  <div className="h-full w-full flex flex-col justify-end pb-8 gap-4 px-12">
                    <Skeleton className="h-[50%] w-full rounded-xl" />
                    <div className="flex justify-between w-full">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ) : isEmpty ? (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <BarChart3 className="w-8 h-8 text-primary opacity-50" />
                    </div>
                    <p className="text-white font-medium mb-1">No data yet</p>
                    <p className="text-[#8D7B77] text-sm">
                      Start creating content to see your performance trend!
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={growthChartData}
                      margin={{ left: 0, right: 20, top: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient
                          id="colorAnalyticsMetric"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1">
                          <stop
                            offset="5%"
                            stopColor="var(--color-primary)"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="50%"
                            stopColor="var(--color-primary)"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--color-primary)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="rgba(255,255,255,0.03)"
                        vertical={true}
                        horizontal={true}
                        strokeDasharray="0"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fill: "#8D7B77",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        tickLine={false}
                        minTickGap={40}
                        dy={10}
                      />
                      <YAxis
                        tick={{
                          fill: "#8D7B77",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                        tickFormatter={(val) => {
                          if (val >= 1000 && metricFilter !== "earnings")
                            return `${(val / 1000).toFixed(1)}k`;
                          if (metricFilter === "earnings")
                            return `₹${
                              val >= 1000 ? (val / 1000).toFixed(1) + "k" : val
                            }`;
                          return val;
                        }}
                      />
                      <Tooltip
                        content={<CustomTooltip metric={metricFilter} />}
                        cursor={{
                          stroke: "var(--color-primary)",
                          strokeWidth: 1,
                          strokeDasharray: "4 4",
                        }}
                      />
                      <ReferenceLine
                        y={chartStats.avg}
                        stroke="var(--color-primary)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorAnalyticsMetric)"
                        activeDot={{
                          r: 8,
                          fill: "var(--color-primary)",
                          stroke: "#fff",
                          strokeWidth: 3,
                          fillOpacity: 1,
                        }}
                        dot={{
                          r: 4,
                          fill: "var(--color-primary)",
                          stroke: "var(--color-bg)",
                          strokeWidth: 2,
                        }}
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
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-[#8D7B77] text-xs">
                      {metricFilter === "earnings"
                        ? "Daily Earnings"
                        : "Daily Plays"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0 border-t border-dashed border-primary opacity-50" />
                    <span className="text-[#8D7B77] text-xs">Average</span>
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
