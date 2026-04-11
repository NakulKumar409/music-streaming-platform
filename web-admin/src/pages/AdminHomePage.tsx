import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { useQuery } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";

type SummaryData = {
  totalArtists: number;
  totalActiveSubscriptions: number;
  revenueToday: number;
  activeReports?: number;
  subscriptionDetails?: {
    newToday: number;
    renewalsToday: number;
    totalActiveValue: number;
  };
  alerts?: {
    draftCount?: number;
    failedPaymentsCount?: number;
  };
};

type SeriesPoint = { date: string; value: number };

type AlertsResponse = {
  success: boolean;
  drafts: Array<{ id: any; title: string | null; created_at: string }>;
  failedPayments: Array<{ id: any; amount: number; created_at: string; status: string }>;
};

type DashboardDataResponse = {
  success: boolean;
  summary: SummaryData;
  growth: SeriesPoint[];
  revenue: SeriesPoint[];
  alerts: AlertsResponse;
};

function BrandLogo() {
  return (
    <img 
      src="/logo.png" 
      alt="Brand Logo" 
      className="h-[44px] w-[44px] rounded-full object-cover"
    />
  );
}

function DashboardCard({
  title,
  value,
  icon,
  accent,
  className,
  subtitle
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: "purple" | "brown" | "orange";
  className?: string;
  subtitle?: React.ReactNode;
}) {
  const accentColor =
    accent === "purple"
      ? "text-[#9a6bb1]"
      : accent === "orange"
        ? "text-[#c9853b]"
        : "text-[#b16e5b]";

  return (
    <div
      className={`relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${className ?? ""}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
      <div className="relative px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#8d7b77]">
              {title}
            </div>
            <div className="mt-2 text-[28px] leading-[30px] font-light tracking-wide text-[#e6d6d2]">
              {value}
            </div>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <div className={`mt-1 ${accentColor}`}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const navigate = useNavigate();

  const formatCurrency = useCallback((amount: number) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "₹0.00";
    return n.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, []);

  const formatCompact = useCallback((n: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString();
  }, []);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_77cf67.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["adminDashboardData"],
    queryFn: async () => {
      try {
        const res = await http.get<DashboardDataResponse>(
          "/api/v1/admin/analytics/dashboard-data"
        );
        return res.data;
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem("adminToken");
          navigate("/admin/login", { replace: true });
        }
        throw e;
      }
    }
  });

  const [pendingApps, setPendingApps] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await http.get("/api/v1/admin/pending-artists");
        const items = Array.isArray((res.data as any)?.items) ? ((res.data as any).items as any[]) : [];
        if (!mounted) return;
        setPendingApps(items.length);
      } catch {
        if (!mounted) return;
        setPendingApps(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const loading = isLoading;
  const summary = data?.summary ?? null;
  const growth = data?.growth ?? [];
  const revenue = data?.revenue ?? [];
  const alerts = data?.alerts ?? null;

  const draftCount =
    Number(alerts?.drafts?.length ?? summary?.alerts?.draftCount ?? 0) || 0;
  const failedPaymentsCount =
    Number(alerts?.failedPayments?.length ?? summary?.alerts?.failedPaymentsCount ?? 0) ||
    0;

  const growthChartData = useMemo(() => growth.map((p: SeriesPoint) => ({
    name: p.date.slice(5),
    value: p.value
  })), [growth]);

  const revenueChartData = useMemo(() => revenue.map((p: SeriesPoint) => ({
    name: p.date.slice(5),
    value: p.value
  })), [revenue]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
          <div className="hidden">
            <BrandLogo />
          </div>

          <div className="mt-10 text-[40px] leading-[44px] font-light tracking-wide text-[#e0c7c0]">
            Admin Home
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link to="/admin/artists" className="block focus:outline-none">
              {loading ? (
                <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 px-5 py-4">
                  <div className="space-y-3">
                    <Skeleton className="h-[10px] w-[90px]" />
                    <Skeleton className="h-[30px] w-[120px]" />
                  </div>
                </div>
              ) : (
                <DashboardCard
                  title="Total Artists"
                  value={formatCompact(summary?.totalArtists ?? 0)}
                  accent="purple"
                  className="cursor-pointer transition hover:border-white/20"
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M17 21V19C17 16.7909 15.2091 15 13 15H6C3.79086 15 2 16.7909 2 19V21"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9.5 11C11.7091 11 13.5 9.20914 13.5 7C13.5 4.79086 11.7091 3 9.5 3C7.29086 3 5.5 4.79086 5.5 7C5.5 9.20914 7.29086 11 9.5 11Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M22 21V19C21.9986 17.1771 20.7668 15.5857 19 15.13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M16 3.13C17.7699 3.58317 19.0042 5.17656 19.0042 7.0025C19.0042 8.82844 17.7699 10.4218 16 10.875"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />
              )}
            </Link>

            <Link to="/admin/artist-applications" className="block focus:outline-none">
              {loading ? (
                <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 px-5 py-4">
                  <div className="space-y-3">
                    <Skeleton className="h-[10px] w-[150px]" />
                    <Skeleton className="h-[30px] w-[90px]" />
                  </div>
                </div>
              ) : (
                <DashboardCard
                  title="Pending Applications"
                  value={formatCompact(pendingApps ?? 0)}
                  accent="orange"
                  className="cursor-pointer transition hover:border-white/20"
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 6V12L16 14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  }
                />
              )}
            </Link>

            <Link to="/admin/moderation" className="block focus:outline-none">
              {loading ? (
                <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 px-5 py-4">
                  <div className="space-y-3">
                    <Skeleton className="h-[10px] w-[110px]" />
                    <Skeleton className="h-[30px] w-[90px]" />
                  </div>
                </div>
              ) : (
                <DashboardCard
                  title="Active Reports"
                  value={formatCompact(Number((summary as any)?.activeReports ?? 0) || 0)}
                  accent="orange"
                  className="cursor-pointer transition hover:border-white/20"
                  icon={
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 9V13"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 17H12.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              )}
            </Link>

            {loading ? (
              <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 px-5 py-4">
                <div className="space-y-3">
                  <Skeleton className="h-[10px] w-[60px]" />
                  <Skeleton className="h-[30px] w-[90px]" />
                </div>
              </div>
            ) : (
              <DashboardCard
                title="Active"
                value={formatCompact(summary?.totalActiveSubscriptions ?? 0)}
                accent="brown"
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 6L9 17L4 12"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
            )}

            {loading ? (
              <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 px-5 py-4">
                <div className="space-y-3">
                  <Skeleton className="h-[10px] w-[110px]" />
                  <Skeleton className="h-[30px] w-[140px]" />
                </div>
              </div>
            ) : (
              <DashboardCard
                title="Revenue Today"
                value={formatCurrency(summary?.revenueToday ?? 0)}
                accent="brown"
                subtitle={
                  <div className="text-[11px] text-[#8d7b77]">
                    <span className="text-[#a99792]">{summary?.subscriptionDetails?.newToday ?? 0}</span> new ·{" "}
                    <span className="text-[#a99792]">{summary?.subscriptionDetails?.renewalsToday ?? 0}</span> renewals
                  </div>
                }
                icon={
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 1V23"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M17 5H9.5C7.01472 5 5 7.01472 5 9.5C5 11.9853 7.01472 14 9.5 14H14.5C16.9853 14 19 16.0147 19 18.5C19 20.9853 16.9853 23 14.5 23H6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              />
            )}

          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-1">
            <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
              <div className="relative px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">
                    Subscribers Growth
                  </div>
                  <div className="rounded-[5px] border border-white/10 bg-[#141010]/40 px-3 py-1 text-[12px] text-[#a99792]">
                    Last 7 days
                  </div>
                </div>

                <div className="mt-4 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "rgba(220,200,195,0.55)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgba(220,200,195,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(20,16,16,0.95)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "rgba(230,214,210,0.9)",
                          borderRadius: 6
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#b16e5b"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#b16e5b", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#c9853b", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
              <div className="relative px-5 py-4">
                <div className="text-[14px] tracking-wide text-[#e6d6d2]">
                  Revenue <span className="text-[#8d7b77]">(Last 7 days)</span>
                </div>

                <div className="mt-4 h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "rgba(220,200,195,0.55)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgba(220,200,195,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(20,16,16,0.95)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "rgba(230,214,210,0.9)",
                          borderRadius: 6
                        }}
                      />
                      <Bar dataKey="value" fill="#7a3f31" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
