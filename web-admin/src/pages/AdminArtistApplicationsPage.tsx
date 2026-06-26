import React, { useState, useEffect, useRef } from "react";
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
  Eye,
  Calendar,
  Hash,
  Link2,
  Database,
  Code2,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  actor_id: number | null;
  actor_role: string;
  status: string;
  correlation_id: string | null;
  ip_address: string | null;
  metadata: any;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <CheckCircle size={12} />
        Success
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle size={12} />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      <Clock size={12} />
      Pending
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    system: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    artist: "bg-green-500/10 text-green-400 border-green-500/20",
    fan: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
        colors[role] || "bg-white/10 text-[#8D7B77] border-white/10"
      }`}>
      <User size={12} />
      {role}
    </span>
  );
}

// Premium Custom Select Component
function PremiumSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  label,
  icon: Icon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  label?: string;
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <div className="flex items-center gap-2 mb-1.5">
          {Icon && <Icon size={14} className="text-[#8D7B77]" />}
          <label className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
            {label}
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`h-[42px] min-w-[140px] rounded-xl bg-[#0A0A0A] border border-white/10 px-4 pr-10 text-sm text-left text-white outline-none transition-all flex items-center justify-between ${
          isOpen
            ? "border-[#E85D2C]/50 ring-2 ring-[#E85D2C]/20"
            : "hover:border-white/20"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
        <span
          className={`truncate ${
            selectedOption ? "text-white" : "text-[#8D7B77]"
          }`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-[#8D7B77] transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 rounded-xl bg-[#15100E] border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="max-h-[200px] overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all ${
                    isSelected
                      ? "bg-[#E85D2C]/10 text-white border border-[#E85D2C]/20"
                      : "text-[#B8A6A1] hover:bg-white/5 hover:text-white"
                  }`}>
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-[#E85D2C] flex items-center justify-center shrink-0">
                      <CheckCircle size={10} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Premium Pagination Component
function PremiumPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      }
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i);
        }
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-white/5 bg-white/5">
      <div className="text-sm text-[#B8A6A1] bg-black/30 px-4 py-2 rounded-xl border border-white/5">
        Showing <span className="text-white font-semibold">{startItem}</span> to{" "}
        <span className="text-white font-semibold">{endItem}</span> of{" "}
        <span className="text-white font-semibold">{totalItems}</span> logs
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="First page">
          <ChevronsLeft size={16} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>

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

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page">
          <ChevronRight size={16} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[#B8A6A1] hover:text-white hover:bg-white/10 hover:border-[#E85D2C]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
  const limit = 15;

  const roleOptions = [
    { value: "", label: "All Roles" },
    { value: "system", label: "System" },
    { value: "admin", label: "Admin" },
    { value: "fan", label: "Fan" },
    { value: "artist", label: "Artist" },
  ];

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "success", label: "Success" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
  ];

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

  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const pendingCount = logs.filter((l) => l.status === "pending").length;

  return (
    <PageWrapper
      title="Audit Logs"
      subtitle="Monitor all system events, webhook failures, and admin actions">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-4 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#8D7B77]">Total Logs</p>
                <p className="mt-1 text-2xl font-bold text-white">{total}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <BarChart3 size={18} className="text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-4 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#8D7B77]">Success</p>
                <p className="mt-1 text-2xl font-bold text-green-400">
                  {successCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-500/10">
                <CheckCircle size={18} className="text-green-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-4 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#8D7B77]">Failed</p>
                <p className="mt-1 text-2xl font-bold text-red-400">
                  {failedCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <XCircle size={18} className="text-red-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-4 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#8D7B77]">Pending</p>
                <p className="mt-1 text-2xl font-bold text-yellow-400">
                  {pendingCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-yellow-500/10">
                <Clock size={18} className="text-yellow-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Enhanced with Premium Dropdowns */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-2xl border border-white/5 bg-[#15100E]">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D7B77]"
            />
            <input
              type="text"
              placeholder="Search by ID, action, or correlation..."
              className="w-full h-[42px] rounded-xl bg-[#0A0A0A] border border-white/10 pl-9 pr-4 text-sm text-white placeholder:text-[#8D7B77] outline-none focus:border-[#E85D2C]/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>

        <PremiumSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={roleOptions}
          placeholder="All Roles"
          icon={Filter}
          label="Role"
        />

        <PremiumSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          placeholder="All Statuses"
          icon={Activity}
          label="Status"
        />

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E85D2C]/10 text-[#E85D2C] border border-[#E85D2C]/20 hover:bg-[#E85D2C]/20 transition-all">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/5 bg-[#15100E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    Timestamp
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  <div className="flex items-center gap-1.5">
                    <Code2 size={12} />
                    Action
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  <div className="flex items-center gap-1.5">
                    <User size={12} />
                    Actor
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  <div className="flex items-center gap-1.5">
                    <Database size={12} />
                    Entity
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-left">
                  <div className="flex items-center gap-1.5">
                    <Activity size={12} />
                    Status
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Eye size={12} />
                    Details
                  </div>
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
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-[#8D7B77]" />
                        {new Date(log.created_at).toLocaleString()}
                      </div>
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
                      <div className="flex items-center gap-1">
                        <span className="text-[#B8A6A1]">{log.entity}</span>
                        <span className="text-[#8D7B77] text-xs">
                          #{log.entity_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="inline-flex items-center gap-1 text-[#E85D2C] hover:text-[#C97A54] transition-all text-xs font-medium">
                        <Eye size={14} />
                        View
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
              <div className="flex items-center gap-2 mt-1">
                <Hash size={12} className="text-[#8D7B77]" />
                <p className="text-xs text-[#8D7B77] font-mono">
                  {selectedLog.id}
                </p>
              </div>
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
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} />
                  Timestamp
                </p>
                <p className="text-sm text-white mt-1">
                  {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 size={12} />
                  Action
                </p>
                <code className="inline-block mt-1 px-2 py-1 rounded-md bg-[#E85D2C]/10 text-[#E85D2C] text-xs font-mono">
                  {selectedLog.action}
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={12} />
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
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} />
                  Actor
                </p>
                <RoleBadge role={selectedLog.actor_role} />
              </div>
            </div>

            {selectedLog.correlation_id && (
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Link2 size={12} />
                  Correlation ID
                </p>
                <code className="block p-3 rounded-xl bg-black/30 border border-white/10 text-xs font-mono text-[#B8A6A1] break-all">
                  {selectedLog.correlation_id}
                </code>
              </div>
            )}

            {selectedLog.ip_address && (
              <div>
                <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Shield size={12} />
                  IP Address
                </p>
                <code className="block p-3 rounded-xl bg-black/30 border border-white/10 text-xs font-mono text-[#B8A6A1]">
                  {selectedLog.ip_address}
                </code>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider flex items-center gap-1.5 mb-2">
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
                    <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                      <XCircle size={12} />
                      Before
                    </p>
                    <pre className="text-xs text-red-300/80 font-mono overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata.before, null, 2)}
                    </pre>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                    <p className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1.5">
                      <CheckCircle size={12} />
                      After
                    </p>
                    <pre className="text-xs text-green-300/80 font-mono overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata.after, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
