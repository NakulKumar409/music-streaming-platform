// src/pages/ArtistContentHistoryPage.tsx
import { useMemo, useState } from "react";
import { http } from "../services/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";
import {
  History,
  Search,
  Music,
  Video,
  Film,
  Play,
  Trash2,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Loader2,
  Filter,
  ListMusic,
  FileAudio,
  FileVideo,
  Calendar,
  BarChart3,
  MoreVertical,
} from "lucide-react";

type HistoryItem = {
  id: number;
  title: string;
  type: string;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  createdAt: string;
  isApproved: boolean;
  lifecycleState?: string;
  status?: string;
  rejectionReason?: string | null;
  totalPlays?: number;
};

type HistoryResponse = {
  success: boolean;
  items?: HistoryItem[];
  message?: string;
  correlationId?: string;
};

type DeleteResponse = {
  success: boolean;
  message?: string;
  correlationId?: string;
};

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

export default function ArtistContentHistoryPage() {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"ALL" | "AUDIO" | "VIDEO">("ALL");
  const [preview, setPreview] = useState<HistoryItem | null>(null);
  const [previewKind, setPreviewKind] = useState<"AUDIO" | "VIDEO">("AUDIO");
  const queryClient = useQueryClient();

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.05) 0%, rgba(10,10,10,0.98) 100%)",
    } as const;
  }, []);

  const historyQueryKey = ["artist", "content", "history"] as const;

  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: async () => {
      const res = await http.get<HistoryResponse>("/api/v1/content/history");
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to load content history");
      }
      return Array.isArray(res.data?.items) ? res.data.items : [];
    },
    placeholderData: (prev: HistoryItem[] | undefined) => prev,
  });

  const items = historyQuery.data ?? [];
  const loading = historyQuery.isLoading;
  const error = historyQuery.isError
    ? (historyQuery.error as any)?.message || "Failed to load content history"
    : null;

  const baseUrl = useMemo(() => {
    return (
      (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000"
    );
  }, []);

  const toAbsoluteUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const type = (it.type || "").toString().toUpperCase();
      const hasAudio =
        Boolean(it.audioUrl || it.mediaUrl) ||
        type === "AUDIO" ||
        type === "AUDIO_VIDEO";
      const hasVideo =
        Boolean(it.videoUrl) || type === "VIDEO" || type === "AUDIO_VIDEO";
      if (tab === "AUDIO" && !hasAudio) return false;
      if (tab === "VIDEO" && !hasVideo) return false;
      if (!q) return true;
      return (it.title || "").toLowerCase().includes(q);
    });
  }, [items, query, tab]);

  const getDisplayType = (it: HistoryItem) => {
    const type = (it.type || "").toString().toUpperCase();
    const hasAudio = Boolean(it.audioUrl || it.mediaUrl);
    const hasVideo = Boolean(it.videoUrl);
    if (type === "AUDIO_VIDEO" || (hasAudio && hasVideo)) return "AUDIO+VIDEO";
    if (type === "VIDEO" || hasVideo) return "VIDEO";
    return "AUDIO";
  };

  const getPreviewUrl = (it: HistoryItem, kind: "AUDIO" | "VIDEO") => {
    if (kind === "VIDEO")
      return toAbsoluteUrl(it.videoUrl ?? it.mediaUrl) ?? null;
    return toAbsoluteUrl(it.audioUrl ?? it.mediaUrl) ?? null;
  };

  const getStatus = (it: HistoryItem) => {
    const lifecycle = (it.lifecycleState || "").toString().toUpperCase();
    const explicit = (it.status || "").toString().toUpperCase();
    const status =
      explicit ||
      (lifecycle === "REJECTED"
        ? "REJECTED"
        : it.isApproved
        ? "PUBLISHED"
        : "PENDING");
    return status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case "REJECTED":
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === "VIDEO") return <Video className="w-4 h-4" />;
    if (type === "AUDIO+VIDEO") return <Film className="w-4 h-4" />;
    return <Music className="w-4 h-4" />;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await http.delete<DeleteResponse>(`/api/v1/content/${id}`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Delete failed");
      }
      return { id };
    },
    onMutate: async (id: number) => {
      setBusyId(id);
      await queryClient.cancelQueries({ queryKey: historyQueryKey });
      const previous =
        queryClient.getQueryData<HistoryItem[]>(historyQueryKey) ?? [];
      queryClient.setQueryData<HistoryItem[]>(
        historyQueryKey,
        (old: HistoryItem[] | undefined) =>
          (old ?? []).filter((x: HistoryItem) => x.id !== id)
      );
      return { previous };
    },
    onError: (
      _err: unknown,
      _id: number,
      ctx: { previous: HistoryItem[] } | undefined
    ) => {
      if (ctx?.previous)
        queryClient.setQueryData(historyQueryKey, ctx.previous);
    },
    onSettled: () => {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
  });

  const onDelete = async (item: HistoryItem) => {
    const id = item.id;
    const ok = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!ok) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="w-full animate-fadeIn" style={backgroundStyle}>
      <div className="rounded-2xl border border-white/10 bg-[#15100E] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#E85D2C]/20 to-[#C97A54]/20 border border-[#E85D2C]/30 flex items-center justify-center">
                <History className="w-5 h-5 text-[#E85D2C]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Content History
                </h1>
                <p className="text-sm text-[#B8A6A1]">
                  All your uploaded audio and video content.
                </p>
              </div>
            </div>
          </div>
          <div className="text-xs text-[#8D7B77] bg-white/5 px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1">
            <ListMusic className="w-3.5 h-3.5" />
            {items.length} {items.length === 1 ? "item" : "items"}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "ALL", label: "All Content", icon: ListMusic },
              { key: "AUDIO", label: "Audio Only", icon: FileAudio },
              { key: "VIDEO", label: "Video Only", icon: FileVideo },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key as any)}
                  className={`h-[36px] px-4 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
                    tab === t.key
                      ? "border-[#E85D2C]/30 bg-[#E85D2C]/10 text-[#E85D2C] shadow-lg shadow-[#E85D2C]/10"
                      : "border-white/10 bg-transparent text-[#B8A6A1] hover:text-white hover:bg-white/5"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5b57]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title..."
              className="h-[38px] w-full md:w-[280px] rounded-xl border border-white/10 bg-[#0A0A0A]/60 pl-9 pr-4 text-sm text-white placeholder-[#6b5b57] outline-none focus:border-[#E85D2C]/50 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-[#8D7B77] border-b border-white/5">
                <th className="py-3 pr-4 font-medium">Title</th>
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 font-medium">Created</th>
                <th className="py-3 pr-4 font-medium">Plays</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-0 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6">
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="grid grid-cols-6 gap-4 items-center">
                          <Skeleton className="h-4 w-[200px]" />
                          <Skeleton className="h-4 w-[80px]" />
                          <Skeleton className="h-4 w-[140px]" />
                          <Skeleton className="h-4 w-[60px]" />
                          <Skeleton className="h-6 w-[100px] rounded-full" />
                          <div className="flex items-center justify-end gap-2">
                            <Skeleton className="h-8 w-[90px]" />
                            <Skeleton className="h-8 w-[90px]" />
                            <Skeleton className="h-8 w-[70px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((it, idx) => {
                  const busy = it.id != null && busyId === it.id;
                  const status = getStatus(it);
                  const isPublished = status === "PUBLISHED";
                  const isRejected = status === "REJECTED";
                  const badgeClass = isPublished
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : isRejected
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400";

                  const typeLabel = getDisplayType(it);
                  const TypeIcon = getTypeIcon(typeLabel);

                  return (
                    <tr
                      key={it.id}
                      className="border-t border-white/5 hover:bg-white/5 transition-all group">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-[#0A0A0A]/60 border border-white/10 flex items-center justify-center text-[#E85D2C]">
                            {TypeIcon}
                          </div>
                          <span className="text-sm font-medium text-white">
                            {it.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="text-xs text-[#B8A6A1] bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-1.5 text-xs text-[#B8A6A1]">
                          <Calendar className="w-3 h-3 text-[#6b5b57]" />
                          {formatDateTime(it.createdAt)}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-1.5 text-xs text-[#B8A6A1]">
                          <BarChart3 className="w-3 h-3 text-[#6b5b57]" />
                          {Number(it.totalPlays ?? 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${badgeClass}`}>
                          {getStatusIcon(status)}
                          {status === "PUBLISHED"
                            ? "Published"
                            : status === "REJECTED"
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      </td>
                      <td className="py-4 pr-0">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!it.audioUrl && !it.mediaUrl}
                            onClick={() => {
                              setPreviewKind("AUDIO");
                              setPreview(it);
                            }}
                            className="h-8 px-3 rounded-lg border border-white/10 bg-[#0A0A0A]/60 text-xs text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40 flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5" />
                            Audio
                          </button>
                          <button
                            type="button"
                            disabled={!it.videoUrl}
                            onClick={() => {
                              setPreviewKind("VIDEO");
                              setPreview(it);
                            }}
                            className="h-8 px-3 rounded-lg border border-white/10 bg-[#0A0A0A]/60 text-xs text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40 flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5" />
                            Video
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDelete(it)}
                            className="h-8 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            {busy ? "" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-16 w-16 rounded-full bg-[#E85D2C]/10 flex items-center justify-center">
                        <ListMusic className="w-8 h-8 text-[#E85D2C] opacity-50" />
                      </div>
                      <p className="text-sm text-[#B8A6A1]">No uploads yet</p>
                      <p className="text-xs text-[#6b5b57]">
                        Start sharing your music with the world
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Video Preview Modal */}
      {preview && previewKind === "VIDEO" && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-6"
          onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-[900px] overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="text-sm font-medium text-white">
                  {preview.title}
                </div>
                <div className="text-xs text-[#B8A6A1]">Video preview</div>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-8 px-4 rounded-lg border border-white/10 bg-[#0A0A0A]/60 text-xs text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5">
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
            <div className="p-6">
              <video
                key={preview.id}
                controls
                autoPlay
                playsInline
                className="w-full rounded-xl bg-black"
                src={getPreviewUrl(preview, "VIDEO") ?? undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Audio Preview Modal */}
      {preview && previewKind === "AUDIO" && (
        <div className="fixed inset-x-0 bottom-0 z-[60] px-6 pb-6">
          <div className="mx-auto w-full max-w-[900px] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {preview.title}
                </div>
                <div className="text-xs text-[#B8A6A1]">Audio preview</div>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-8 px-4 rounded-lg border border-white/10 bg-[#0A0A0A]/60 text-xs text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5">
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
            <div className="px-6 py-4">
              <audio
                key={preview.id}
                controls
                autoPlay
                className="w-full"
                src={getPreviewUrl(preview, "AUDIO") ?? undefined}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
