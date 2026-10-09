import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Music,
  RefreshCw,
  ShieldAlert,
  Video,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import { http } from "../services/http";

type ModerationItem = {
  id: number;
  title: string;
  type: string;
  genre: string | null;
  reportCount?: number;
  reasons?: Array<{ reason: string; count: number }>;
  artist: { id: number; name: string | null };
};

const reportedKey = ["admin", "content", "reported"] as const;

function MediaIcon({ type }: { type: string }) {
  return type === "VIDEO" ? <Video size={17} /> : <Music size={17} />;
}

export default function AdminContentApprovalQueuePage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reported = useQuery({
    queryKey: reportedKey,
    queryFn: async () => {
      const response = await http.get("/api/v1/admin/content/reported", {
        params: { limit: 100 },
      });
      return (Array.isArray(response.data?.items)
        ? response.data.items
        : []) as ModerationItem[];
    },
  });

  const takedown = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await http.post(`/api/v1/admin/content/${id}/takedown`, { reason });
      return id;
    },
    onSuccess: async () => {
      setError(null);
      setNotice(
        "Content taken down. New fan discovery and playback access are blocked immediately."
      );
      await queryClient.invalidateQueries({ queryKey: reportedKey });
    },
    onError: (e: any) => {
      setNotice(null);
      setError(e?.response?.data?.message || "Takedown failed");
    },
  });

  const [reasonModal, setReasonModal] = useState<{
    itemId: number;
    itemTitle: string;
    reason: string;
    error: string | null;
  } | null>(null);

  const handleModalSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reasonModal) return;
    const reason = reasonModal.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      setReasonModal((prev) =>
        prev ? { ...prev, error: "Reason must be 3–500 characters." } : null
      );
      return;
    }

    const id = reasonModal.itemId;
    setReasonModal(null);
    takedown.mutate({ id, reason });
  };

  const items = reported.data ?? [];
  const totalReports = items.reduce(
    (sum, item) => sum + Number(item.reportCount || 0),
    0
  );

  return (
    <PageWrapper
      title="Content Moderation"
      subtitle="Artists publish their own releases. Admin and moderators only review reported live content and perform takedowns when required."
    >
      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-surface p-5">
          <div className="text-sm text-white/50">Reported releases</div>
          <div className="mt-2 text-3xl font-semibold text-orange-300">
            {items.length}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface p-5">
          <div className="text-sm text-white/50">Open fan reports</div>
          <div className="mt-2 text-3xl font-semibold text-orange-300">
            {totalReports}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mb-4 flex gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-green-200">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface">
        <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Flag size={16} className="text-orange-300" />
              Reported live content
            </div>
            <div className="mt-1 text-xs text-white/45">
              Reports are moderation signals only. Content is never auto-taken-down by report count.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reported.refetch()}
            disabled={reported.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={reported.isFetching ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {reported.isLoading ? (
          <div className="p-10 text-center text-white/50">
            Loading reported content…
          </div>
        ) : reported.isError ? (
          <div className="p-10 text-center text-red-300">
            Unable to load reported content.
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            No live content currently has fan reports.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((item) => {
              const busy =
                takedown.isPending && takedown.variables?.id === item.id;

              return (
                <div key={item.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-orange-500/10 p-2 text-orange-300">
                        <MediaIcon type={item.type} />
                      </div>
                      <div>
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-white/45">
                          #{item.id} · {item.artist?.name || `Artist #${item.artist?.id}`} · {item.reportCount || 0} report(s)
                        </div>
                        {!!item.reasons?.length && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.reasons.map((reason, index) => (
                              <span
                                key={`${reason.reason}-${index}`}
                                className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-200"
                              >
                                {reason.reason}: {reason.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setReasonModal({
                          itemId: item.id,
                          itemTitle: item.title,
                          reason: "",
                          error: null,
                        })
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-40"
                    >
                      <ShieldAlert size={15} />
                      {busy ? "Taking down…" : "Take down"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6 shadow-premium">
            <h2 className="text-lg font-semibold text-white">
              Take Down Content
            </h2>
            <p className="mt-1 text-xs text-muted">
              Release: <span className="font-medium text-primary">“{reasonModal.itemTitle}”</span>
            </p>

            {reasonModal.error && (
              <div className="mt-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{reasonModal.error}</span>
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="mt-4">
              <label className="block text-xs font-medium text-muted">
                Mandatory governance reason (3–500 characters)
              </label>
              <textarea
                value={reasonModal.reason}
                onChange={(e) =>
                  setReasonModal((prev) =>
                    prev
                      ? { ...prev, reason: e.target.value, error: null }
                      : null
                  )
                }
                rows={3}
                maxLength={500}
                placeholder="Enter mandatory reason..."
                autoFocus
                className="mt-2 w-full rounded-xl border border-white/10 bg-inputbg p-3 text-sm text-white placeholder-white/30 outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-colors"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>Must be between 3 and 500 characters</span>
                <span className="font-mono">{reasonModal.reason.length}/500</span>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReasonModal(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={takedown.isPending}
                  className="rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                >
                  Confirm take down
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
