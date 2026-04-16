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

  return (
    <div className="flex h-full w-full bg-gray-50 text-gray-900 relative">
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Terminal className="text-blue-500" />
              System Audit Logs
            </h1>
            <p className="text-sm text-gray-500">Monitor all system events, webhook failures, and admin actions.</p>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
          <form onSubmit={handleSearch} className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by ID, correlation, or action..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="border rounded-lg px-3 py-2 text-sm outline-none bg-transparent focus:ring-2 focus:ring-blue-500"
              value={roleFilter}
              onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}
            >
              <option value="">All Roles</option>
              <option value="system">System</option>
              <option value="admin">Admin</option>
              <option value="fan">Fan</option>
              <option value="artist">Artist</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm outline-none bg-transparent focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1">
          <div className="overflow-x-auto h-full max-h-[600px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-500">Timestamp</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Action</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Actor</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Entity</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No logs found matching your criteria.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/50 transition cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <td className="px-6 py-3 text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-indigo-600 font-medium">
                      {log.action}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        log.actor_role === 'system' ? 'bg-gray-100 text-gray-700' : 
                        log.actor_role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.actor_role} {log.actor_id ? `#${log.actor_id}` : ''}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600 text-xs">
                      {log.entity} <span className="opacity-50">#{log.entity_id}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        log.status === 'success' ? 'bg-green-100 text-green-700' : 
                        log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button className="text-blue-500 hover:underline text-xs flex items-center gap-1">
                        View <Activity className="w-3 h-3"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="p-4 border-t flex justify-between items-center text-sm text-gray-500">
            <span>Showing {logs.length} of {total} logs</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
              <button disabled={logs.length < 50} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Drawer Component */}
      {selectedLog && (
        <div className="absolute top-0 right-0 h-full w-[500px] bg-white shadow-2xl border-l flex flex-col z-50 animate-in slide-in-from-right">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                Log Details
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  selectedLog.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {selectedLog.status}
                </span>
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-1">{selectedLog.id}</p>
            </div>
            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-200 rounded-full transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Timestamp</p>
                <p className="font-medium text-sm">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Action</p>
                <p className="font-mono text-sm text-indigo-600 bg-indigo-50 inline-block px-1 rounded">{selectedLog.action}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Entity</p>
                <p className="font-medium text-sm">{selectedLog.entity} <span className="text-gray-400">({selectedLog.entity_id})</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Actor</p>
                <p className="font-medium text-sm capitalize">{selectedLog.actor_role} {selectedLog.actor_id && `(#${selectedLog.actor_id})`}</p>
              </div>
            </div>

            {selectedLog.correlation_id && (
               <div>
                 <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Correlation ID / Trace</p>
                 <p className="font-mono text-xs p-2 bg-gray-50 border rounded text-gray-600">{selectedLog.correlation_id}</p>
               </div>
            )}

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2 flex items-center gap-2">
                <FileJson className="w-4 h-4"/> Metadata Payload
              </p>
              <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-xl text-xs overflow-x-auto shadow-inner border border-gray-800">
                <code>{JSON.stringify(selectedLog.metadata, null, 2)}</code>
              </pre>
            </div>
            
            {/* Diff Viewer (if before/after exists in metadata) */}
            {selectedLog.metadata?.before && selectedLog.metadata?.after && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">State Diff</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-red-50 p-3 rounded border border-red-100">
                    <p className="text-red-800 mb-2 font-bold">- Before</p>
                    <pre className="text-red-900 bg-transparent">{JSON.stringify(selectedLog.metadata.before, null, 2)}</pre>
                  </div>
                  <div className="bg-green-50 p-3 rounded border border-green-100">
                    <p className="text-green-800 mb-2 font-bold">+ After</p>
                    <pre className="text-green-900 bg-transparent">{JSON.stringify(selectedLog.metadata.after, null, 2)}</pre>
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
