import React, { useState, useEffect } from "react";
import { http } from "../services/http";
import { Search, Filter, RefreshCw, X, FileJson, Activity, Terminal } from "lucide-react";

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

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await http.get(`/api/v1/admin/audit`, {
        params: {
          page,
          limit: 50,
          search: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        }
      });
      if (data.success) {
        setLogs(data.data || []);
        setTotal(data.meta?.total ?? 0);
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

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full text-white relative">
      <div className="flex-1 flex flex-col w-full min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
              <Terminal className="text-primary w-6 h-6 shrink-0" />
              System Audit Logs
            </h1>
            <p className="text-sm text-[#8D7B77] mt-1">
              Monitor immutable system events, webhook failures, security traces, and admin actions.
            </p>
          </div>
          <button
            onClick={fetchLogs}
            className="self-start sm:self-auto flex items-center justify-center gap-2 px-4 py-2 bg-surface hover:bg-card border border-white/10 rounded-xl text-sm font-medium text-white transition shadow-sm shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-surface p-4 rounded-2xl border border-white/10 mb-6 flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
          <form onSubmit={handleSearch} className="w-full md:flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D7B77] w-5 h-5 shrink-0" />
            <input
              type="text"
              placeholder="Search by ID, correlation, or action..."
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-[#8D7B77] focus:outline-none focus:border-primary text-sm transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
            <div className="flex-1 sm:flex-initial flex items-center gap-2 min-w-0">
              <Filter className="w-4 h-4 text-[#8D7B77] shrink-0" />
              <select
                className="w-full sm:w-auto border border-white/10 rounded-xl px-3 py-2 text-sm outline-none bg-black/40 text-white focus:border-primary transition"
                value={roleFilter}
                onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}
              >
                <option value="" className="bg-[#181818] text-white">All Roles</option>
                <option value="system" className="bg-[#181818] text-white">System</option>
                <option value="admin" className="bg-[#181818] text-white">Admin</option>
                <option value="fan" className="bg-[#181818] text-white">Fan</option>
                <option value="artist" className="bg-[#181818] text-white">Artist</option>
              </select>
            </div>

            <div className="flex-1 sm:flex-initial flex items-center gap-2 min-w-0">
              <select
                className="w-full sm:w-auto border border-white/10 rounded-xl px-3 py-2 text-sm outline-none bg-black/40 text-white focus:border-primary transition"
                value={statusFilter}
                onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
              >
                <option value="" className="bg-[#181818] text-white">All Statuses</option>
                <option value="success" className="bg-[#181818] text-white">Success</option>
                <option value="pending" className="bg-[#181818] text-white">Pending</option>
                <option value="failed" className="bg-[#181818] text-white">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface rounded-2xl border border-white/10 overflow-hidden flex-1 flex flex-col min-w-0 max-w-full">
          <div className="overflow-x-auto w-full max-h-[600px]">
            <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
              <thead className="bg-white/5 border-b border-white/10 sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-[#8D7B77]">Timestamp</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-[#8D7B77]">Action</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-[#8D7B77]">Actor</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-[#8D7B77]">Entity</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-[#8D7B77]">Status</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-[#8D7B77]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 sm:px-6 text-center text-[#8D7B77]">
                      No audit logs found matching your criteria.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-white/5 transition cursor-pointer border-b border-white/5"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 sm:px-6 text-[#B8A6A1]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 sm:px-6 font-mono text-xs text-primary font-medium">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                        log.actor_role === 'system' ? 'bg-white/10 text-gray-300 border border-white/10' : 
                        log.actor_role === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {log.actor_role} {log.actor_id ? `#${log.actor_id}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6 text-white text-xs">
                      {log.entity} <span className="text-[#8D7B77]">#{log.entity_id}</span>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                        log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        log.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <button className="text-primary hover:text-primary-hover text-xs flex items-center gap-1 font-medium">
                        View <Activity className="w-3.5 h-3.5"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between items-center gap-3 text-sm text-[#8D7B77] bg-surface">
            <span className="text-xs sm:text-sm">Showing {logs.length} of {total} logs</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-white hover:bg-white/10 disabled:opacity-40 transition text-xs sm:text-sm"
              >
                Prev
              </button>
              <button
                disabled={logs.length < 50}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-white hover:bg-white/10 disabled:opacity-40 transition text-xs sm:text-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Drawer Component */}
      {selectedLog && (
        <div className="fixed sm:absolute top-0 right-0 h-full w-full sm:w-[540px] max-w-full bg-surface shadow-2xl border-l border-white/10 flex flex-col z-50 animate-in slide-in-from-right">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                Log Details
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  selectedLog.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {selectedLog.status}
                </span>
              </h3>
              <p className="text-xs text-[#8D7B77] font-mono mt-1">{selectedLog.id}</p>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="p-2 hover:bg-white/10 rounded-full transition text-[#8D7B77] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6 text-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-1">Timestamp</p>
                <p className="font-medium text-sm text-white">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-1">Action</p>
                <p className="font-mono text-sm text-primary bg-primary/10 inline-block px-2 py-0.5 rounded border border-primary/20">
                  {selectedLog.action}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-1">Entity</p>
                <p className="font-medium text-sm text-white">
                  {selectedLog.entity} <span className="text-[#8D7B77]">({selectedLog.entity_id})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-1">Actor</p>
                <p className="font-medium text-sm capitalize text-white">
                  {selectedLog.actor_role} {selectedLog.actor_id && `(#${selectedLog.actor_id})`}
                </p>
              </div>
            </div>

            {selectedLog.correlation_id && (
               <div>
                 <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-1">Correlation ID / Trace</p>
                 <p className="font-mono text-xs p-2.5 bg-black/40 border border-white/10 rounded-xl text-gray-300 break-all">
                   {selectedLog.correlation_id}
                 </p>
               </div>
            )}

            <div>
              <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-2 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-primary"/> Metadata Payload
              </p>
              <pre className="bg-black/60 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto shadow-inner border border-white/10 font-mono">
                <code>{JSON.stringify(selectedLog.metadata, null, 2)}</code>
              </pre>
            </div>
            
            {/* Diff Viewer (if before/after exists in metadata) */}
            {selectedLog.metadata?.before && selectedLog.metadata?.after && (
              <div className="mt-4">
                <p className="text-xs text-[#8D7B77] uppercase tracking-wide font-semibold mb-2">State Diff</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-red-950/30 p-3 rounded-xl border border-red-500/20">
                    <p className="text-red-400 mb-2 font-bold">- Before</p>
                    <pre className="text-red-300 bg-transparent overflow-x-auto">{JSON.stringify(selectedLog.metadata.before, null, 2)}</pre>
                  </div>
                  <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/20">
                    <p className="text-emerald-400 mb-2 font-bold">+ After</p>
                    <pre className="text-emerald-300 bg-transparent overflow-x-auto">{JSON.stringify(selectedLog.metadata.after, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
