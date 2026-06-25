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
  YAxis,
} from "recharts";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";
import {
  Users,
  UserPlus,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Music,
  Eye,
  ThumbsUp,
  Zap,
} from "lucide-react";

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
  failedPayments: Array<{
    id: any;
    amount: number;
    created_at: string;
    status: string;
  }>;
};

type DashboardDataResponse = {
  success: boolean;
  summary: SummaryData;
  growth: SeriesPoint[];
  revenue: SeriesPoint[];
  alerts: AlertsResponse;
};

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
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6 hover:border-white/10 transition-all duration-300 group">
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

function QuickActionCard({
  title,
  value,
  icon: Icon,
  color = "orange",
  onClick,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: "orange" | "purple" | "green" | "blue";
  onClick?: () => void;
  subtitle?: string;
}) {
  const colorMap = {
    orange: "border-[#E85D2C]/20 hover:border-[#E85D2C]/40",
    purple: "border-[#8B5CF6]/20 hover:border-[#8B5CF6]/40",
    green: "border-[#10B981]/20 hover:border-[#10B981]/40",
    blue: "border-[#3B82F6]/20 hover:border-[#3B82F6]/40",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-[#15100E] p-4 cursor-pointer transition-all duration-300 group ${colorMap[color]}`}
      onClick={onClick}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />

      <div className="relative flex items-center gap-4">
        <div
          className={`p-2.5 rounded-xl bg-gradient-to-br from-[#E85D2C]/10 to-[#C97A54]/5`}>
          <Icon size={18} className="text-[#E85D2C]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#8D7B77]">{title}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-[#8D7B77] mt-0.5">{subtitle}</p>
          )}
        </div>

        <ArrowUpRight
          size={14}
          className="text-[#8D7B77] group-hover:text-white transition-colors"
        />
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const navigate = useNavigate();

  const formatCurrency = useCallback((amount: number) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "₹0";
    return n.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }, []);

  const formatCompact = useCallback((n: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000) return (v / 1000).toFixed(1) + "K";
    return v.toLocaleString();
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
    },
  });

  const [pendingApps, setPendingApps] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await http.get("/api/v1/admin/pending-artists");
        const items = Array.isArray((res.data as any)?.items)
          ? ((res.data as any).items as any[])
          : [];
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
    Number(
      alerts?.failedPayments?.length ??
        summary?.alerts?.failedPaymentsCount ??
        0
    ) || 0;

  const growthChartData = useMemo(
    () =>
      growth.map((p: SeriesPoint) => ({
        name: p.date.slice(5),
        value: p.value,
      })),
    [growth]
  );

  const revenueChartData = useMemo(
    () =>
      revenue.map((p: SeriesPoint) => ({
        name: p.date.slice(5),
        value: p.value,
      })),
    [revenue]
  );

  const stats = [
    {
      title: "Total Revenue",
      value: formatCurrency(summary?.revenueToday ?? 0),
      icon: DollarSign,
      trend: "up" as const,
      trendValue: "12.5%",
      color: "orange" as const,
      subtitle: `${formatCompact(
        summary?.totalActiveSubscriptions ?? 0
      )} active subscribers`,
    },
    {
      title: "Total Artists",
      value: formatCompact(summary?.totalArtists ?? 0),
      icon: Users,
      trend: "up" as const,
      trendValue: "8.2%",
      color: "purple" as const,
    },
    {
      title: "Active Subscriptions",
      value: formatCompact(summary?.totalActiveSubscriptions ?? 0),
      icon: Activity,
      trend: "up" as const,
      trendValue: "5.7%",
      color: "green" as const,
    },
    {
      title: "Conversion Rate",
      value: "24.8%",
      icon: TrendingUp,
      trend: "up" as const,
      trendValue: "3.1%",
      color: "blue" as const,
    },
  ];

  const quickActions = [
    {
      title: "Pending Applications",
      value: formatCompact(pendingApps ?? 0),
      icon: UserPlus,
      color: "orange" as const,
      onClick: () => navigate("/admin/artist-applications"),
      subtitle: "Awaiting review",
    },
    {
      title: "Active Reports",
      value: formatCompact(Number((summary as any)?.activeReports ?? 0) || 0),
      icon: AlertTriangle,
      color: "orange" as const,
      onClick: () => navigate("/admin/moderation"),
      subtitle: "Content flagged",
    },
    {
      title: "New Today",
      value: formatCompact(summary?.subscriptionDetails?.newToday ?? 0),
      icon: UserPlus,
      color: "green" as const,
      onClick: () => navigate("/admin/analytics"),
      subtitle: "New subscriptions",
    },
    {
      title: "Renewals Today",
      value: formatCompact(summary?.subscriptionDetails?.renewalsToday ?? 0),
      icon: Calendar,
      color: "blue" as const,
      onClick: () => navigate("/admin/analytics"),
      subtitle: "Subscription renewals",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A]">
      {/* Main content with proper spacing for sidebar */}
      <div className="w-full px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Dashboard
              </h1>
              <p className="mt-1 text-[#8D7B77]">
                Welcome back! Here's what's happening with your platform today.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live
              </span>
              <span className="text-sm text-[#8D7B77]">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ))
            : stats.map((stat, index) => <StatCard key={index} {...stat} />)}
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/5 bg-[#15100E] p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-12" />
                </div>
              ))
            : quickActions.map((action, index) => (
                <QuickActionCard key={index} {...action} />
              ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Growth Chart */}
          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-medium text-[#8D7B77]">
                  Subscriber Growth
                </h3>
                <p className="text-2xl font-bold text-white mt-1">
                  {loading
                    ? "..."
                    : formatCompact(growth[growth.length - 1]?.value || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#8D7B77]">
                <Clock size={14} />
                <span>Last 7 days</span>
              </div>
            </div>

            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={growthChartData}
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
          </div>

          {/* Revenue Chart */}
          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-medium text-[#8D7B77]">Revenue</h3>
                <p className="text-2xl font-bold text-white mt-1">
                  {loading
                    ? "..."
                    : formatCurrency(
                        revenue.reduce((acc, curr) => acc + curr.value, 0)
                      )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#8D7B77]">
                <Calendar size={14} />
                <span>Last 7 days</span>
              </div>
            </div>

            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
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
                  <Bar
                    dataKey="value"
                    fill="#E85D2C"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {(draftCount > 0 || failedPaymentsCount > 0) && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {draftCount > 0 && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <AlertTriangle size={16} className="text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-500">
                      Draft Content
                    </p>
                    <p className="text-sm text-[#8D7B77]">
                      {draftCount} {draftCount === 1 ? "item" : "items"} pending
                      review
                    </p>
                    <Link
                      to="/admin/moderation"
                      className="text-xs text-yellow-500/70 hover:text-yellow-500 mt-1 inline-block">
                      Review now →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {failedPaymentsCount > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-500">
                      Failed Payments
                    </p>
                    <p className="text-sm text-[#8D7B77]">
                      {failedPaymentsCount}{" "}
                      {failedPaymentsCount === 1
                        ? "transaction"
                        : "transactions"}{" "}
                      failed
                    </p>
                    <Link
                      to="/admin/audit"
                      className="text-xs text-red-500/70 hover:text-red-500 mt-1 inline-block">
                      View details →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
