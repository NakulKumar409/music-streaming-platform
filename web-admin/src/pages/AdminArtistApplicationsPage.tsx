import React, { useState, useEffect } from "react";
import { http } from "../services/http";
import PageWrapper from "../components/PageWrapper";
import {
  Search,
  RefreshCw,
  X,
  FileJson,
  Activity,
  Terminal,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

type PendingItem = {
  id: number;
  name: string | null;
  email: string;
  submittedAt: string | null;
  artistStatus?: string;
  artistBio: string;
  portfolioLinks: string[];
  appealMessage?: string | null;
  appealed?: boolean;
  adminNote?: string | null;
};

type PendingArtistsResponse = {
  success: boolean;
  items?: PendingItem[];
  message?: string;
};

export default function AdminArtistApplicationsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const [active, setActive] = useState<PendingItem | null>(null);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await http.get<PendingArtistsResponse>("/api/v1/admin/pending-artists");
      console.log("Pending artists response:", res.data);
      const next = Array.isArray(res.data?.items) ? (res.data.items as PendingItem[]) : [];
      setItems(next);
      setActive(next[0] ?? null);
    } catch (e: any) {
      console.error("Failed to load pending artists:", e);
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin/login", { replace: true });
        return;
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-white/5">
      {/* Left - Items info */}
      <div className="text-sm text-[#B8A6A1] bg-white/5 px-4 py-2 rounded-xl border border-white/5">
        Showing <span className="text-white font-semibold">{startItem}</span> to{" "}
        <span className="text-white font-semibold">{endItem}</span> of{" "}
        <span className="text-white font-semibold">{totalItems}</span> results
      </div>

      {/* Right - Pagination controls */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/10"
          aria-label="First page">
          <ChevronsLeft size={16} />
        </button>

        {/* Previous page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/10"
          aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((page, index) => {
            if (page === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="h-10 w-10 flex items-center justify-center text-[#8D7B77] text-sm">
                  …
                </span>
              );
            }

            const isActive = currentPage === page;
            return (
              <button
                key={index}
                type="button"
                onClick={() => typeof page === "number" && onPageChange(page)}
                className={`h-10 min-w-[40px] px-2 flex items-center justify-center rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#E85D2C] text-white shadow-lg shadow-[#E85D2C]/30 border border-[#E85D2C]"
                    : "text-[#B8A6A1] hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10"
                }`}>
                {page}
              </button>
            );
          })}
        </div>

        {/* Next page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/10"
          aria-label="Next page">
          <ChevronRight size={16} />
        </button>

        {/* Last page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/10"
          aria-label="Last page">
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const limit = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await http.get(`/api/v1/admin/audit`, {
        params: {
          page,
          limit,
          search: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      if (data.success) {
        setLogs(data.data);
        setTotal(data.meta.total);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PageWrapper
      title="Audit Logs"
      subtitle="Monitor all system events and admin actions">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D7B77]"
            />
            <input
              type="text"
              placeholder="Search by ID, action, or correlation..."
              className="w-full h-[42px] rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 text-sm text-white placeholder:text-[#8D7B77] outline-none focus:border-[#E85D2C]/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-[#8D7B77]" />
          <select
            className="h-[42px] rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-[#E85D2C]/50 transition-all"
            value={roleFilter}
            onChange={(e) => {
              setPage(1);
              setRoleFilter(e.target.value);
            }}>
            <option value="">All Roles</option>
            <option value="system">System</option>
            <option value="admin">Admin</option>
            <option value="fan">Fan</option>
            <option value="artist">Artist</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-[42px] rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-[#E85D2C]/50 transition-all"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}>
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white hover:bg-white/10 transition-all">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/5 bg-[#15100E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  Timestamp
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  Action
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  Actor
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  Entity
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-right">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#E85D2C]/20 border-t-[#E85D2C]"></div>
                    <p className="text-sm text-[#8D7B77] mt-2">
                      Loading logs...
                    </p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="inline-flex p-4 rounded-full bg-white/5 mb-3">
                      <Activity size={24} className="text-[#8D7B77]" />
                    </div>
                    <p className="text-sm font-medium text-white">
                      No logs found
                    </p>
                    <p className="text-xs text-[#8D7B77] mt-1">
                      Try adjusting your filters
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-white/5 transition-all cursor-pointer"
                    onClick={() => setSelectedLog(log)}>
                    <td className="px-6 py-4 text-[#B8A6A1] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <code className="px-2 py-1 rounded-md bg-[#E85D2C]/10 text-[#E85D2C] text-xs font-mono">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={log.actor_role} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[#B8A6A1]">{log.entity}</span>
                      <span className="text-[#8D7B77] text-xs ml-1">
                        #{log.entity_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[#E85D2C] hover:text-[#C97A54] transition-all text-xs font-medium">
                        View →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Premium Pagination */}
        {total > 0 && (
          <PremiumPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={limit}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[560px] bg-[#15100E] border-l border-white/10 shadow-2xl animate-in slide-in-from-right">
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Log Details
                <StatusBadge status={selectedLog.status} />
              </h3>
              <p className="text-xs text-[#8D7B77] font-mono mt-1">
                {selectedLog.id}
              </p>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="p-2 rounded-xl hover:bg-white/10 transition-all">
              <X size={20} className="text-[#8D7B77]" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(100vh-100px)] space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
                  Timestamp
                </p>
                <p className="text-sm text-white mt-1">
                  {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
                  Action
                </p>
                <code className="inline-block mt-1 px-2 py-1 rounded-md bg-[#E85D2C]/10 text-[#E85D2C] text-xs font-mono">
                  {selectedLog.action}
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
                  Entity
                </p>
                <p className="text-sm text-white mt-1">
                  {selectedLog.entity}{" "}
                  <span className="text-[#8D7B77]">
                    #{selectedLog.entity_id}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
                  Actor
                </p>
                <RoleBadge role={selectedLog.actor_role} />
              </div>
            </div>

            {selectedLog.correlation_id && (
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1">
                  Correlation ID
                </p>
                <code className="block p-3 rounded-xl bg-black/30 border border-white/10 text-xs font-mono text-[#B8A6A1] break-all">
                  {selectedLog.correlation_id}
                </code>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileJson size={14} />
                Metadata
              </p>
              <pre className="p-4 rounded-xl bg-black/30 border border-white/10 text-xs font-mono text-[#B8A6A1] overflow-x-auto max-h-[300px] overflow-y-auto">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>

            {selectedLog.metadata?.before && selectedLog.metadata?.after && (
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-2">
                  State Diff
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                    <p className="text-xs font-medium text-red-400 mb-2">
                      Before
                    </p>
                    <pre className="text-xs text-red-300/80 font-mono overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata.before, null, 2)}
                    </pre>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                    <p className="text-xs font-medium text-green-400 mb-2">
                      After
                    </p>
                    <pre className="text-xs text-green-300/80 font-mono overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata.after, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}