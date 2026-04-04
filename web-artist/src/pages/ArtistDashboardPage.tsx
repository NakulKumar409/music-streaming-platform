import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";

import ErrorBoundary from "../components/ErrorBoundary";
import Skeleton from "../components/Skeleton";

export default function ArtistDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["artist", "dashboard"],
    queryFn: async () => {
      const [s, g] = await Promise.all([
        http.get("/api/v1/artist/dashboard/summary"),
        http.get("/api/v1/artist/dashboard/growth?days=30")
      ]);

      return {
        stats: s.data?.stats ?? null,
        growth: Array.isArray(g.data?.data) ? g.data.data : []
      };
    }
  });

  const loading = dashboardQuery.isLoading;
  const stats = dashboardQuery.data?.stats ?? null;
  const growth = dashboardQuery.data?.growth ?? [];

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

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)]" style={backgroundStyle}>
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
          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/25 px-7 py-6">
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

          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/25 px-7 py-6">
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

          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/25 px-7 py-6">
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
          <div className="mt-6 rounded-[10px] border border-white/10 bg-[#0e0a0a]/22 px-7 py-6">
            <div className="flex items-center justify-between">
              <div className="text-[14px] tracking-wide text-[#e6d6d2]">Growth here</div>
              <div className="h-[28px] px-3 rounded-[6px] border border-white/10 bg-[#141010]/60 text-[12px] text-[#cdbdb8] flex items-center">
                Last 30 days
              </div>
            </div>

            <div className="mt-4 h-[250px]">
              {loading ? (
                <div className="h-full w-full grid grid-cols-1 gap-3">
                  <Skeleton className="h-[16px] w-[180px]" />
                  <Skeleton className="h-[220px] w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthChartData} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "rgba(230,214,210,0.6)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(230,214,210,0.6)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,16,16,0.95)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 8
                      }}
                      labelStyle={{ color: "rgba(230,214,210,0.8)" }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#c97a54" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </ErrorBoundary>


      </div>
    </div>
  );
}

