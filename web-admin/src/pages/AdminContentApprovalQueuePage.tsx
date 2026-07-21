import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../services/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";
import PageWrapper from "../components/PageWrapper";
import {
  Eye,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Image,
  Music,
  Video,
  FileText,
  User,
  Flag,
  Trash2,
  RotateCcw,
  AlertCircle,
  Play,
  Volume2,
  Users,
  TrendingUp,
  Zap,
  Crown,
} from "lucide-react";

type PendingItem = {
  id: number;
  title: string;
  type: string;
  thumbnailUrl: string | null;
  mediaUrl?: string | null;
  fileUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  status: string;
  reportCount?: number;
  reasons?: Array<{ reason: string; count: number }>;
  artist?: {
    id: number;
    name: string | null;
  };
};

const isAbsoluteUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

const toAbsoluteUrl = (value: string | null | undefined, baseUrl: string) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (isAbsoluteUrl(raw)) return raw;
  if (raw.startsWith("/")) return `${baseUrl}${raw}`;
  return `${baseUrl}/${raw}`;
};

function PreviewModal({
  open,
  item,
  onClose,
  baseUrl,
}: {
  open: boolean;
  item: PendingItem | null;
  onClose: () => void;
  baseUrl: string;
}) {
  const [mediaError, setMediaError] = useState<string | null>(null);

  const audioUrl = toAbsoluteUrl(
    item?.audioUrl ?? item?.mediaUrl ?? item?.fileUrl ?? null,
    baseUrl
  );
  const videoUrl = toAbsoluteUrl(item?.videoUrl ?? null, baseUrl);

  const hasAudio = Boolean(audioUrl);
  const hasVideo = Boolean(videoUrl);
  const derivedType =
    item?.type === "AUDIO_VIDEO"
      ? "AUDIO / VIDEO"
      : item?.type ||
        (hasAudio && hasVideo ? "AUDIO / VIDEO" : hasVideo ? "VIDEO" : "AUDIO");

  useEffect(() => {
    if (!open) return;
    setMediaError(null);
  }, [open, item?.id]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div className="w-full max-w-[800px] rounded-2xl border border-white/10 bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white truncate">
              {item.title}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-[#8D7B77]">{derivedType}</span>
              <span className="text-[#8D7B77]">•</span>
              <span className="text-sm text-[#8D7B77]">ID: #{item.id}</span>
            </div>
          </div>
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-white/10 transition-all"
            onClick={onClose}>
            <XCircle size={20} className="text-[#8D7B77] hover:text-white" />
          </button>
        </div>

        <div className="p-6">
          {(!hasAudio || !hasVideo) && (
            <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={18} className="text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-400">
                  Missing Media
                </p>
                <div className="text-sm text-yellow-300/80 mt-0.5">
                  {!hasAudio && <div>• Audio file not found</div>}
                  {!hasVideo && <div>• Video file not found</div>}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {mediaError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300/80">
                Failed to load media. Please verify the file URL is reachable.
              </div>
            )}

            <div className="rounded-xl border border-white/5 bg-black/30 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/5">
                <Volume2 size={14} className="text-[#8D7B77]" />
                <span className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
                  Audio Preview
                </span>
              </div>
              <div className="p-4">
                {audioUrl ? (
                  <audio
                    src={audioUrl}
                    controls
                    preload="metadata"
                    onError={() => setMediaError("FAILED")}
                    className="w-full"
                  />
                ) : (
                  <div className="text-sm text-[#8D7B77]">
                    No audio available
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/30 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/5">
                <Play size={14} className="text-[#8D7B77]" />
                <span className="text-xs font-medium text-[#8D7B77] uppercase tracking-wider">
                  Video Preview
                </span>
              </div>
              <div className="p-4">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    preload="metadata"
                    onError={() => setMediaError("FAILED")}
                    className="w-full rounded-lg border border-white/5 bg-black"
                  />
                ) : (
                  <div className="text-sm text-[#8D7B77]">
                    No video available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlaggedBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
      <Flag size={12} />
      {count} report{count !== 1 ? "s" : ""}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const getIcon = () => {
    if (type === "AUDIO" || type === "AUDIO_VIDEO") return <Music size={12} />;
    if (type === "VIDEO") return <Video size={12} />;
    return <FileText size={12} />;
  };

  const getColor = () => {
    if (type === "AUDIO")
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (type === "VIDEO")
      return "bg-green-500/10 text-green-400 border-green-500/20";
    if (type === "AUDIO_VIDEO")
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    return "bg-gray-500/10 text-[#8D7B77] border-gray-500/20";
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getColor()}`}>
      {getIcon()}
      {type === "AUDIO_VIDEO" ? "Audio/Video" : type}
    </span>
  );
}

export default function AdminContentApprovalQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const baseUrl = http.defaults.baseURL || "";

  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<PendingItem | null>(null);

  const pendingQueryKey = ["admin", "content", "flagged"] as const;

  const pendingQuery = useQuery({
    queryKey: pendingQueryKey,
    queryFn: async () => {
      const res = await http.get("/api/v1/admin/content/flagged");
      const next = Array.isArray(res.data?.items)
        ? (res.data.items as PendingItem[])
        : [];
      return next;
    },
  });

  const items = (pendingQuery.data ?? []).map((x: PendingItem) => ({
    ...x,
    thumbnailUrl: toAbsoluteUrl(x.thumbnailUrl, baseUrl),
    mediaUrl: toAbsoluteUrl(x.mediaUrl ?? null, baseUrl),
    fileUrl: toAbsoluteUrl(x.fileUrl ?? null, baseUrl),
    audioUrl: toAbsoluteUrl(x.audioUrl ?? null, baseUrl),
    videoUrl: toAbsoluteUrl(x.videoUrl ?? null, baseUrl),
  }));

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.post(`/api/v1/admin/content/${id}/restore`, {});
      return id;
    },
    onMutate: async (id: number) => {
      setBusyId(id);
      await queryClient.cancelQueries({ queryKey: pendingQueryKey });
      const previous =
        queryClient.getQueryData<PendingItem[]>(pendingQueryKey) ?? [];
      queryClient.setQueryData<PendingItem[]>(
        pendingQueryKey,
        (old: PendingItem[] | undefined) =>
          (old ?? []).filter((x: PendingItem) => x.id !== id)
      );
      return { previous };
    },
    onError: (
      _err: unknown,
      _id: number,
      ctx: { previous: PendingItem[] } | undefined
    ) => {
      if (ctx?.previous)
        queryClient.setQueryData(pendingQueryKey, ctx.previous);
    },
    onSettled: () => {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: pendingQueryKey });
      queryClient.invalidateQueries({
        queryKey: ["admin", "analytics", "dashboard-data"],
      });
    },
  });

  const deleteStrikeMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.post(`/api/v1/admin/content/${id}/delete-strike`, {});
      return id;
    },
    onMutate: async (id: number) => {
      setBusyId(id);
      await queryClient.cancelQueries({ queryKey: pendingQueryKey });
      const previous =
        queryClient.getQueryData<PendingItem[]>(pendingQueryKey) ?? [];
      queryClient.setQueryData<PendingItem[]>(
        pendingQueryKey,
        (old: PendingItem[] | undefined) =>
          (old ?? []).filter((x: PendingItem) => x.id !== id)
      );
      return { previous };
    },
    onError: (
      _err: unknown,
      _id: number,
      ctx: { previous: PendingItem[] } | undefined
    ) => {
      if (ctx?.previous)
        queryClient.setQueryData(pendingQueryKey, ctx.previous);
    },
    onSettled: () => {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: pendingQueryKey });
      queryClient.invalidateQueries({
        queryKey: ["admin", "analytics", "dashboard-data"],
      });
    },
  });

  const totalReports = items.reduce(
    (acc, item) => acc + (item.reportCount || 0),
    0
  );
  const uniqueItems = items.length;
  const audioItems = items.filter(
    (i) => i.type === "AUDIO" || i.type === "AUDIO_VIDEO"
  ).length;
  const videoItems = items.filter(
    (i) => i.type === "VIDEO" || i.type === "AUDIO_VIDEO"
  ).length;

  return (
    <PageWrapper
      title="Content Moderation"
      subtitle="Review and manage flagged content reported by users">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">
                  Flagged Items
                </p>
                <p className="mt-1.5 text-3xl font-bold text-white">
                  {uniqueItems}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10">
                <Flag size={20} className="text-red-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">
                  Total Reports
                </p>
                <p className="mt-1.5 text-3xl font-bold text-yellow-400">
                  {totalReports}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <AlertTriangle size={20} className="text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">
                  Audio Content
                </p>
                <p className="mt-1.5 text-3xl font-bold text-blue-400">
                  {audioItems}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Music size={20} className="text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">
                  Video Content
                </p>
                <p className="mt-1.5 text-3xl font-bold text-green-400">
                  {videoItems}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10">
                <Video size={20} className="text-green-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="rounded-2xl border border-white/5 bg-surface overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1fr_200px_120px_280px] gap-4 px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider border-b border-white/5 bg-white/5">
          <div>Content</div>
          <div>Reports</div>
          <div>Type</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Loading State */}
        {pendingQuery.isLoading ? (
          <div className="px-6 py-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-[66px] w-[66px] rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <p className="text-lg font-medium text-white">All Clear! 🎉</p>
            <p className="text-sm text-[#8D7B77] mt-1">
              No flagged content pending review
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((item: PendingItem) => {
              const artistName = item.artist?.name || "Unknown artist";
              const hasAudio = Boolean(
                item.audioUrl || item.mediaUrl || item.fileUrl
              );
              const hasVideo = Boolean(item.videoUrl);
              const typeLabel =
                item.type === "AUDIO_VIDEO"
                  ? "AUDIO / VIDEO"
                  : item.type ||
                    (hasAudio && hasVideo
                      ? "AUDIO / VIDEO"
                      : hasVideo
                      ? "VIDEO"
                      : "AUDIO");
              const reportCount = Number(item.reportCount ?? 0);
              const reasons = Array.isArray(item.reasons) ? item.reasons : [];

              return (
                <div
                  key={item.id}
                  className="px-6 py-4 hover:bg-white/5 transition-all">
                  <div className="flex flex-col md:grid md:grid-cols-[1fr_200px_120px_280px] gap-4 items-start md:items-center">
                    {/* Content Info */}
                    <div className="flex items-center gap-4 min-w-0 w-full">
                      <div className="h-[66px] w-[66px] shrink-0 rounded-xl bg-black/30 border border-white/10 overflow-hidden flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[#8D7B77]">
                            <Image size={24} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <User size={12} className="text-[#8D7B77]" />
                          <span className="text-xs text-[#8D7B77] truncate">
                            {artistName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reports */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <FlaggedBadge count={reportCount} />
                      {reasons.length > 0 && (
                        <span className="text-xs text-[#8D7B77] hidden lg:inline">
                          {reasons
                            .slice(0, 2)
                            .map((r) => r.reason)
                            .join(", ")}
                          {reasons.length > 2 && ` +${reasons.length - 2}`}
                        </span>
                      )}
                    </div>

                    {/* Type */}
                    <TypeBadge type={typeLabel} />

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="h-[36px] px-3 rounded-xl border border-white/10 bg-white/5 text-[#8D7B77] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
                        title="Preview">
                        <Eye size={16} />
                        <span className="text-xs hidden sm:inline">
                          Preview
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => restoreMutation.mutate(item.id)}
                        className="h-[36px] px-4 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50">
                        <RotateCcw size={14} />
                        <span className="text-xs font-medium">Restore</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => deleteStrikeMutation.mutate(item.id)}
                        className="h-[36px] px-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50">
                        <Trash2 size={14} />
                        <span className="text-xs font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <PreviewModal
        open={Boolean(previewItem)}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        baseUrl={baseUrl}
      />
    </PageWrapper>
  );
}
