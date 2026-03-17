import { useMemo, useState } from "react";
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

function PremiumPlayLogo() {
  return (
    <div className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-[#1a1414]/80 border border-white/10 flex items-center justify-center">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
        </svg>
      </div>
    </div>
  );
}

function formatCurrency(amount: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCompact(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString();
}

function DashboardCard({
  title,
  value,
  icon,
  accent,
  className
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: "purple" | "brown" | "orange";
  className?: string;
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
          </div>
          <div className={`mt-1 ${accentColor}`}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_77cf67.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  const dashboardQuery = useQuery({
    queryKey: ["admin", "analytics", "dashboard-data"],
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

  const loading = dashboardQuery.isLoading;
  const summary = dashboardQuery.data?.summary ?? null;
  const growth = dashboardQuery.data?.growth ?? [];
  const revenue = dashboardQuery.data?.revenue ?? [];
  const alerts = dashboardQuery.data?.alerts ?? null;

  const draftCount =
    Number(alerts?.drafts?.length ?? summary?.alerts?.draftCount ?? 0) || 0;
  const failedPaymentsCount =
    Number(alerts?.failedPayments?.length ?? summary?.alerts?.failedPaymentsCount ?? 0) ||
    0;

  const growthChartData = growth.map((p: SeriesPoint) => ({
    name: p.date.slice(5),
    value: p.value
  }));
  const revenueChartData = revenue.map((p: SeriesPoint) => ({
    name: p.date.slice(5),
    value: p.value
  }));

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PremiumPlayLogo />
              <Link to="/admin/artists" className="text-[13px] text-[#b8a6a1] hover:text-white">
                Artists
              </Link>
              <Link
                to="/admin/analytics"
                className="text-[13px] text-[#b8a6a1] hover:text-white"
              >
                Analytics
              </Link>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 text-[13px] text-[#d8c7c3] hover:text-white"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>Admin</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 9L12 15L18 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-3 w-[180px] rounded-[6px] border border-white/10 bg-[#141010]/90 backdrop-blur px-2 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-[13px] text-[#d8c7c3] hover:bg-white/5 rounded-[4px]"
                    onClick={() => {
                      localStorage.removeItem("adminToken");
                      navigate("/admin/login", { replace: true });
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
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

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
              <div className="relative px-5 py-4">
                <div className="text-[14px] tracking-wide text-[#e6d6d2]">Alerts</div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[13px] text-[#cdbdb8]">
                      <div className="h-[14px] w-[10px] rounded-[2px] bg-rose-500/40 border border-white/10" />
                      <div>
                        {loading ? (
                          <Skeleton className="h-[14px] w-[200px]" />
                        ) : (
                          <>
                            <span className="text-[#e6d6d2]">{failedPaymentsCount}</span> subscription payments failed
                          </>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[4px] bg-[#4a1d1d]/65 border border-[#a04a4a]/25 px-3 py-[3px] text-[12px] text-[#d19a9a]">
                      Failed
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-[13px] text-[#8d7b77]">View all alerts</div>
              </div>
            </div>

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
