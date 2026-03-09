import { useMemo, useState } from "react";
import { http } from "../services/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";

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
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.10) 0%, rgba(25,18,18,0.55) 45%, rgba(10,8,8,0.92) 100%)"
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
    placeholderData: (prev: HistoryItem[] | undefined) => prev
  });

  const items = historyQuery.data ?? [];
  const loading = historyQuery.isLoading;
  const error = historyQuery.isError
    ? ((historyQuery.error as any)?.message || "Failed to load content history")
    : null;

  const baseUrl = useMemo(() => {
    return (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";
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
      const hasAudio = Boolean(it.audioUrl || it.mediaUrl) || type === "AUDIO" || type === "AUDIO_VIDEO";
      const hasVideo = Boolean(it.videoUrl) || type === "VIDEO" || type === "AUDIO_VIDEO";
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
    if (kind === "VIDEO") return toAbsoluteUrl(it.videoUrl ?? it.mediaUrl) ?? null;
    return toAbsoluteUrl(it.audioUrl ?? it.mediaUrl) ?? null;
  };

  const getStatus = (it: HistoryItem) => {
    const lifecycle = (it.lifecycleState || "").toString().toUpperCase();
    const explicit = (it.status || "").toString().toUpperCase();
    const status = explicit || (lifecycle === "REJECTED" ? "REJECTED" : it.isApproved ? "PUBLISHED" : "PENDING");
    return status;
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
      const previous = queryClient.getQueryData<HistoryItem[]>(historyQueryKey) ?? [];
      queryClient.setQueryData<HistoryItem[]>(historyQueryKey, (old: HistoryItem[] | undefined) =>
        (old ?? []).filter((x: HistoryItem) => x.id !== id)
      );
      return { previous };
    },
    onError: (_err: unknown, _id: number, ctx: { previous: HistoryItem[] } | undefined) => {
      if (ctx?.previous) queryClient.setQueryData(historyQueryKey, ctx.previous);
    },
    onSettled: () => {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
    }
  });

  const onDelete = async (item: HistoryItem) => {
    const id = item.id;

    const ok = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!ok) return;

    const clientTs = new Date().toISOString();
    console.log(
      `--------------------------------------------------\n[ARTIST_UI_DELETE] ${clientTs} contentId=${id} action=CLICK title=${item.title}`
    );

    try {
      const res = await deleteMutation.mutateAsync(id);
      const clientTs2 = new Date().toISOString();
      console.log(
        `--------------------------------------------------\n[ARTIST_UI_DELETE] ${clientTs2} contentId=${res.id} action=SUCCESS correlationId=-`
      );
    } catch (e: any) {
      const clientTs3 = new Date().toISOString();
      console.log(
        `--------------------------------------------------\n[ARTIST_UI_DELETE] ${clientTs3} contentId=${id} action=ERROR message=${e?.message || "Delete failed"}`
      );
    }
  };

  return (
    <div className="w-full" style={backgroundStyle}>
      <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur px-7 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[18px] font-light tracking-wide">Content History</div>
            <div className="mt-1 text-[13px] text-[#b8a6a1]">All your uploaded audio and video content.</div>
          </div>
        </div>

        {error ? <div className="mt-4 text-[13px] text-[#e3a1a1]">{error}</div> : null}

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("ALL")}
                className={`h-[34px] px-4 rounded-[999px] border text-[12px] tracking-wide ${
                  tab === "ALL" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-[#b8a6a1] hover:text-white"
                }`}
              >
                All Content
              </button>
              <button
                type="button"
                onClick={() => setTab("AUDIO")}
                className={`h-[34px] px-4 rounded-[999px] border text-[12px] tracking-wide ${
                  tab === "AUDIO" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-[#b8a6a1] hover:text-white"
                }`}
              >
                Audio Only
              </button>
              <button
                type="button"
                onClick={() => setTab("VIDEO")}
                className={`h-[34px] px-4 rounded-[999px] border text-[12px] tracking-wide ${
                  tab === "VIDEO" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-[#b8a6a1] hover:text-white"
                }`}
              >
                Video Only
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title..."
                className="h-[38px] w-full md:w-[320px] rounded-[8px] border border-white/10 bg-[#141010]/55 px-3 text-[13px] text-[#f0e5e2] outline-none focus:border-white/20"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[12px] text-[#b8a6a1]">
                <th className="py-3 pr-4 font-normal">Title</th>
                <th className="py-3 pr-4 font-normal">Type</th>
                <th className="py-3 pr-4 font-normal">Created</th>
                <th className="py-3 pr-4 font-normal">Total Plays</th>
                <th className="py-3 pr-4 font-normal">Status</th>
                <th className="py-3 pr-0 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-6 gap-4 items-center">
                        <Skeleton className="h-[14px] w-[220px]" />
                        <Skeleton className="h-[14px] w-[80px]" />
                        <Skeleton className="h-[14px] w-[140px]" />
                        <Skeleton className="h-[14px] w-[90px]" />
                        <Skeleton className="h-[22px] w-[110px] rounded-[999px]" />
                        <div className="flex items-center justify-end gap-2">
                          <Skeleton className="h-[32px] w-[80px]" />
                          <Skeleton className="h-[32px] w-[90px]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4 items-center">
                        <Skeleton className="h-[14px] w-[200px]" />
                        <Skeleton className="h-[14px] w-[80px]" />
                        <Skeleton className="h-[14px] w-[140px]" />
                        <Skeleton className="h-[14px] w-[90px]" />
                        <Skeleton className="h-[22px] w-[110px] rounded-[999px]" />
                        <div className="flex items-center justify-end gap-2">
                          <Skeleton className="h-[32px] w-[80px]" />
                          <Skeleton className="h-[32px] w-[90px]" />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((it, idx) => {
                  const id = it.id;
                  const busy = id != null && busyId === id;
                  const status = getStatus(it);
                  const isRejected = status === "REJECTED";
                  const isPublished = status === "PUBLISHED";
                  const badgeClass = isPublished
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                    : isRejected
                      ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-200";

                  const rawType = (it.type || "").toString().toUpperCase();
                  const canPreviewAudio = Boolean(it.audioUrl || it.mediaUrl) || rawType === "AUDIO" || rawType === "AUDIO_VIDEO";
                  const canPreviewVideo = Boolean(it.videoUrl) || rawType === "VIDEO" || rawType === "AUDIO_VIDEO";
                  const typeLabel = getDisplayType(it);
                  return (
                    <tr key={`${id ?? idx}`} className="border-t border-white/10">
                      <td className="py-4 pr-4 text-[13px] text-[#f0e5e2]">{it.title}</td>
                      <td className="py-4 pr-4 text-[12px] text-[#d8c7c3]">{typeLabel}</td>
                      <td className="py-4 pr-4 text-[12px] text-[#d8c7c3]">{formatDateTime(it.createdAt)}</td>
                      <td className="py-4 pr-4 text-[12px] text-[#d8c7c3]">{Number(it.totalPlays ?? 0).toLocaleString()}</td>
                      <td className="py-4 pr-4 text-[12px]">
                        <span
                          title={isRejected ? it.rejectionReason || "Rejected" : undefined}
                          className={`inline-flex items-center rounded-[999px] border px-2.5 py-1 text-[11px] ${badgeClass}`}
                        >
                          {status === "PUBLISHED"
                            ? "Published"
                            : status === "REJECTED"
                              ? "Rejected"
                              : "Pending Approval"}
                        </span>
                      </td>
                      <td className="py-4 pr-0">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!canPreviewAudio}
                            onClick={() => {
                              setPreviewKind("AUDIO");
                              setPreview(it);
                            }}
                            className="h-[32px] rounded-[6px] border border-white/10 bg-[#141010]/60 px-3 text-[12px] font-light tracking-wide text-[#e6d6d2] hover:bg-white/5 disabled:opacity-40"
                          >
                            Preview Audio
                          </button>

                          <button
                            type="button"
                            disabled={!canPreviewVideo}
                            onClick={() => {
                              setPreviewKind("VIDEO");
                              setPreview(it);
                            }}
                            className="h-[32px] rounded-[6px] border border-white/10 bg-[#141010]/60 px-3 text-[12px] font-light tracking-wide text-[#e6d6d2] hover:bg-white/5 disabled:opacity-40"
                          >
                            Preview Video
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDelete(it)}
                            className="h-[32px] rounded-[6px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] px-3 text-[12px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.25)] disabled:opacity-60"
                          >
                            {busy ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-[13px] text-[#d8c7c3]">
                    No uploads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && previewKind === "VIDEO" ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6" onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-[980px] overflow-hidden rounded-[12px] border border-white/10 bg-[#0e0a0a] shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-[14px] text-[#f0e5e2]">{preview.title}</div>
                <div className="mt-0.5 text-[12px] text-[#b8a6a1]">Video preview</div>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-[32px] rounded-[8px] border border-white/10 bg-[#141010]/60 px-3 text-[12px] text-[#e6d6d2] hover:bg-white/5"
              >
                Close
              </button>
            </div>
            <div className="p-5">
              <video
                key={preview.id}
                controls
                autoPlay
                playsInline
                className="w-full rounded-[10px] bg-black"
                src={getPreviewUrl(preview, "VIDEO") ?? undefined}
              />
            </div>
          </div>
        </div>
      ) : null}

      {preview && previewKind === "AUDIO" ? (
        <div className="fixed inset-x-0 bottom-0 z-[60] px-6 pb-6">
          <div className="mx-auto w-full max-w-[1100px] rounded-[12px] border border-white/10 bg-[#141010]/90 backdrop-blur shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-[13px] text-[#f0e5e2] truncate">{preview.title}</div>
                <div className="mt-0.5 text-[12px] text-[#b8a6a1]">Audio preview</div>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-[32px] rounded-[8px] border border-white/10 bg-[#0e0a0a]/40 px-3 text-[12px] text-[#e6d6d2] hover:bg-white/5"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4">
              <audio key={preview.id} controls autoPlay className="w-full" src={getPreviewUrl(preview, "AUDIO") ?? undefined} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
