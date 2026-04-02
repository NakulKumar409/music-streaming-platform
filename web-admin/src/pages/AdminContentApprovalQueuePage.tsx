import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../services/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";

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

const EyeIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 12C4.6 7.3 8.1 5 12 5C15.9 5 19.4 7.3 21.5 12C19.4 16.7 15.9 19 12 19C8.1 19 4.6 16.7 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.2C13.7673 15.2 15.2 13.7673 15.2 12C15.2 10.2327 13.7673 8.8 12 8.8C10.2327 8.8 8.8 10.2327 8.8 12C8.8 13.7673 10.2327 15.2 12 15.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
};

const isAbsoluteUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

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
  baseUrl
}: {
  open: boolean;
  item: PendingItem | null;
  onClose: () => void;
  baseUrl: string;
}) {
  const [mediaError, setMediaError] = useState<string | null>(null);

  const audioUrl = toAbsoluteUrl(item?.audioUrl ?? item?.mediaUrl ?? item?.fileUrl ?? null, baseUrl);
  const videoUrl = toAbsoluteUrl(item?.videoUrl ?? null, baseUrl);

  const hasAudio = Boolean(audioUrl);
  const hasVideo = Boolean(videoUrl);
  const derivedType = item?.type === "AUDIO_VIDEO" ? "AUDIO / VIDEO" : (item?.type || (hasAudio && hasVideo ? "AUDIO / VIDEO" : hasVideo ? "VIDEO" : "AUDIO"));

  useEffect(() => {
    if (!open) return;
    setMediaError(null);
  }, [open, item?.id]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[720px] rounded-[12px] border border-white/10 bg-[#141010] shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-[14px] text-[#e6d6d2] truncate">{item.title}</div>
            <div className="text-[12px] text-[#a99792]">{derivedType}</div>
          </div>
          <button
            type="button"
            className="h-[34px] px-4 rounded-[8px] border border-white/10 bg-white/5 text-[13px] text-[#e6d6d2] hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-5">
          {!hasAudio || !hasVideo ? (
            <div className="mb-4 rounded-[10px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
              Missing required media:
              <div className="mt-2 text-[12px] text-rose-100">
                {!hasAudio ? "- Audio file missing" : null}
                {!hasVideo ? <div>- Video file missing</div> : null}
              </div>
            </div>
          ) : null}

          <div className="relative space-y-4">
            {mediaError ? (
              <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-[#e6b0b0]">
                Failed to load media. Please verify the backend is running and the file URL is reachable.
              </div>
            ) : null}

            <div className="rounded-[10px] border border-white/10 bg-black/30 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/10 text-[12px] text-[#cdbdb8]">Audio</div>
              <div className="p-3">
                {audioUrl ? (
                  <audio
                    src={audioUrl}
                    controls
                    preload="metadata"
                    onError={() => setMediaError("FAILED")}
                    className="w-full"
                  />
                ) : (
                  <div className="text-[13px] text-[#b8a6a1]">Audio missing</div>
                )}
              </div>
            </div>

            <div className="rounded-[10px] border border-white/10 bg-black/30 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/10 text-[12px] text-[#cdbdb8]">Video</div>
              <div className="p-3">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    preload="metadata"
                    onError={() => setMediaError("FAILED")}
                    className="w-full rounded-[10px] border border-white/10 bg-black"
                  />
                ) : (
                  <div className="text-[13px] text-[#b8a6a1]">Video missing</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PremiumPlayLogo() {
  return (
    <div className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-[#1a1414]/80 border border-white/10 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
        </svg>
      </div>
    </div>
  );
}

function FlaggedBadge() {
  return (
    <span className="inline-flex items-center rounded-[4px] bg-[#7a4b28]/45 border border-[#c9853b]/25 px-3 py-[4px] text-[12px] text-[#d8b58a]">
      Flagged
    </span>
  );
}

export default function AdminContentApprovalQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const baseUrl = http.defaults.baseURL || "";

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 35% 15%, rgba(193,117,86,0.18) 0%, rgba(45,15,23,0.92) 55%, rgba(10,8,8,0.97) 100%)"
    } as const;
  }, []);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<PendingItem | null>(null);

  const pendingQueryKey = ["admin", "content", "flagged"] as const;

  const pendingQuery = useQuery({
    queryKey: pendingQueryKey,
    queryFn: async () => {
      const res = await http.get("/api/v1/admin/content/flagged");
      const next = Array.isArray(res.data?.items) ? (res.data.items as PendingItem[]) : [];
      return next;
    }
  });

  const items = (pendingQuery.data ?? []).map((x: PendingItem) => ({
    ...x,
    thumbnailUrl: toAbsoluteUrl(x.thumbnailUrl, baseUrl),
    mediaUrl: toAbsoluteUrl(x.mediaUrl ?? null, baseUrl),
    fileUrl: toAbsoluteUrl(x.fileUrl ?? null, baseUrl),
    audioUrl: toAbsoluteUrl(x.audioUrl ?? null, baseUrl),
    videoUrl: toAbsoluteUrl(x.videoUrl ?? null, baseUrl)
  }));

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.post(`/api/v1/admin/content/${id}/restore`, {});
      return id;
    },
    onMutate: async (id: number) => {
      setBusyId(id);
      await queryClient.cancelQueries({ queryKey: pendingQueryKey });
      const previous = queryClient.getQueryData<PendingItem[]>(pendingQueryKey) ?? [];
      queryClient.setQueryData<PendingItem[]>(pendingQueryKey, (old: PendingItem[] | undefined) =>
        (old ?? []).filter((x: PendingItem) => x.id !== id)
      );
      return { previous };
    },
    onError: (_err: unknown, _id: number, ctx: { previous: PendingItem[] } | undefined) => {
      if (ctx?.previous) queryClient.setQueryData(pendingQueryKey, ctx.previous);
    },
    onSettled: () => {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: pendingQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics", "dashboard-data"] });
    }
  });

  const deleteStrikeMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.post(`/api/v1/admin/content/${id}/delete-strike`, {});
      return id;
    },
    onMutate: async (id: number) => {
      setBusyId(id);
      await queryClient.cancelQueries({ queryKey: pendingQueryKey });
      const previous = queryClient.getQueryData<PendingItem[]>(pendingQueryKey) ?? [];
      queryClient.setQueryData<PendingItem[]>(pendingQueryKey, (old: PendingItem[] | undefined) =>
        (old ?? []).filter((x: PendingItem) => x.id !== id)
      );
      return { previous };
    },
    onError: (_err: unknown, _id: number, ctx: { previous: PendingItem[] } | undefined) => {
      if (ctx?.previous) queryClient.setQueryData(pendingQueryKey, ctx.previous);
    },
    onSettled: () => {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: pendingQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics", "dashboard-data"] });
    }
  });

  return (
    <div className="min-h-screen w-full bg-[#0a0808] text-white" style={backgroundStyle}>
      <div className="mx-auto w-full max-w-[1100px] px-6 py-8">
        <div className="hidden">
          <PremiumPlayLogo />
        </div>

        <div className="mt-8 text-[34px] font-light tracking-wide text-[#e6d6d2]">Moderation Queue</div>

        <div className="mt-6 rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="px-6 py-4 border-b border-white/10 hidden md:block">
            <div className="grid grid-cols-[1fr_220px_120px_260px] gap-4 text-[12px] uppercase tracking-widest text-[#b8a6a1]">
              <div>Content</div>
              <div>Reports</div>
              <div>Type</div>
              <div className="text-right pr-2">Actions</div>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {pendingQuery.isLoading ? (
              <div className="px-6 py-6 space-y-6 md:space-y-4">
                <div className="flex flex-col md:grid md:grid-cols-[1fr_220px_120px_260px] gap-4 items-start md:items-center pb-6 md:pb-0 border-b md:border-none border-white/10 last:border-none">
                  <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
                    <Skeleton className="h-[66px] w-[66px] rounded-[10px]" />
                    <div className="min-w-0 space-y-2 flex-1">
                      <Skeleton className="h-[14px] w-3/4 md:w-[220px]" />
                      <Skeleton className="h-[12px] w-1/2 md:w-[140px]" />
                    </div>
                  </div>
                  <Skeleton className="h-[22px] w-[140px] hidden md:block" />
                  <Skeleton className="h-[14px] w-[80px] hidden md:block" />
                  <div className="flex items-center justify-start md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0">
                    <Skeleton className="h-[34px] w-[42px]" />
                    <Skeleton className="h-[34px] w-[92px]" />
                    <Skeleton className="h-[34px] w-[92px]" />
                  </div>
                </div>
                <div className="flex flex-col md:grid md:grid-cols-[1fr_220px_120px_260px] gap-4 items-start md:items-center pb-6 md:pb-0 border-b md:border-none border-white/10 last:border-none">
                  <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
                    <Skeleton className="h-[66px] w-[66px] rounded-[10px]" />
                    <div className="min-w-0 space-y-2 flex-1">
                      <Skeleton className="h-[14px] w-3/4 md:w-[200px]" />
                      <Skeleton className="h-[12px] w-1/2 md:w-[120px]" />
                    </div>
                  </div>
                  <Skeleton className="h-[22px] w-[140px] hidden md:block" />
                  <Skeleton className="h-[14px] w-[80px] hidden md:block" />
                  <div className="flex items-center justify-start md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0">
                    <Skeleton className="h-[34px] w-[42px]" />
                    <Skeleton className="h-[34px] w-[92px]" />
                    <Skeleton className="h-[34px] w-[92px]" />
                  </div>
                </div>
                <div className="flex flex-col md:grid md:grid-cols-[1fr_220px_120px_260px] gap-4 items-start md:items-center pb-6 md:pb-0 border-b md:border-none border-white/10 last:border-none">
                  <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
                    <Skeleton className="h-[66px] w-[66px] rounded-[10px]" />
                    <div className="min-w-0 space-y-2 flex-1">
                      <Skeleton className="h-[14px] w-3/4 md:w-[240px]" />
                      <Skeleton className="h-[12px] w-1/2 md:w-[160px]" />
                    </div>
                  </div>
                  <Skeleton className="h-[22px] w-[140px] hidden md:block" />
                  <Skeleton className="h-[14px] w-[80px] hidden md:block" />
                  <div className="flex items-center justify-start md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0">
                    <Skeleton className="h-[34px] w-[42px]" />
                    <Skeleton className="h-[34px] w-[92px]" />
                    <Skeleton className="h-[34px] w-[92px]" />
                  </div>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-[13px] text-[#b8a6a1]">No flagged items.</div>
            ) : (
              items.map((item: PendingItem) => {
                const artistName = item.artist?.name || "Unknown artist";
                const hasAudio = Boolean(item.audioUrl || item.mediaUrl || item.fileUrl);
                const hasVideo = Boolean(item.videoUrl);
                const typeLabel = item.type === "AUDIO_VIDEO" ? "AUDIO / VIDEO" : (item.type || (hasAudio && hasVideo ? "AUDIO / VIDEO" : hasVideo ? "VIDEO" : "AUDIO"));
                const reportCount = Number(item.reportCount ?? 0);
                const reasons = Array.isArray(item.reasons) ? item.reasons : [];
                return (
                  <div key={item.id} className="px-6 py-4">
                    <div className="flex flex-col md:grid md:grid-cols-[1fr_220px_120px_260px] gap-4 items-start md:items-center">
                      <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
                        <div className="h-[66px] w-[66px] shrink-0 rounded-[10px] bg-[#0e0a0a]/50 border border-white/10 overflow-hidden flex items-center justify-center">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] text-[#e6d6d2] truncate font-medium md:font-normal">{item.title}</div>
                          <div className="text-[12px] text-[#a99792] truncate">{artistName}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-start w-full md:w-auto pt-2 md:pt-0 border-t border-white/5 md:border-0 -mx-2 px-2 md:mx-0 md:px-0">
                        <span className="md:hidden text-[12px] text-[#b8a6a1]">Reports</span>
                        <div className="space-y-1 md:space-y-2 text-right md:text-left">
                          <div className="flex items-center justify-end md:justify-start gap-2">
                            <FlaggedBadge />
                            <div className="text-[12px] text-[#a99792]">{reportCount} reports</div>
                          </div>
                          {reasons.length ? (
                            <div className="text-[12px] text-[#b8a6a1]">
                              {reasons
                                .slice(0, 3)
                                .map((r) => `${String(r?.reason ?? '').toString()}: ${Number(r?.count ?? 0)}`)
                                .join(" · ")}
                            </div>
                          ) : (
                            <div className="text-[12px] text-[#8d7b77]">No reasons</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-start w-full md:w-auto -mx-2 px-2 md:mx-0 md:px-0 py-1 md:py-0">
                        <span className="md:hidden text-[12px] text-[#b8a6a1]">Type</span>
                        <div className="text-[13px] text-[#cdbdb8]">{typeLabel}</div>
                      </div>

                      <div className="flex items-center justify-start md:justify-end gap-2 md:gap-3 w-full md:w-auto flex-wrap pt-3 md:pt-0 mt-1 md:mt-0 border-t md:border-t-0 border-white/5">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="h-[34px] w-[40px] shrink-0 rounded-[6px] border border-white/10 bg-white/5 text-[#e6d6d2] hover:bg-white/10 flex items-center justify-center"
                          title="Preview"
                        >
                          <EyeIcon className="h-[18px] w-[18px]" />
                        </button>

                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => restoreMutation.mutate(item.id)}
                          className="h-[34px] flex-1 md:flex-none px-4 md:px-5 rounded-[6px] border border-[#2b5a3b]/45 bg-gradient-to-b from-[#2d5639] to-[#1a2f23] text-[13px] font-light text-[#d9eadf] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
                        >
                          Restore
                        </button>

                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => deleteStrikeMutation.mutate(item.id)}
                          className="h-[34px] flex-1 md:flex-none px-4 md:px-5 rounded-[6px] border border-[#6e2c2c]/40 bg-gradient-to-b from-[#5d1f1f] to-[#2f1212] text-[13px] font-light text-[#f0d2d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
                        >
                          Delete & Strike
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <PreviewModal
        open={Boolean(previewItem)}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        baseUrl={baseUrl}
      />
    </div>
  );
}
