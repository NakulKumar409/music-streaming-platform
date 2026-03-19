import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { http } from "../services/http";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";

type ArtistDetail = {
  id: number;
  name: string | null;
  email: string;
  profileImage: string | null;
  bannerImage: string | null;
  isVerified: boolean;
  subscriptionPrice: number;
  phone: string | null;
  genre: string | null;
  bio: string;
  socialLinks: Record<string, any> | null;
  revenueSharePercentage: number;
  adminRemarks: string | null;
  status: string;
  totalContentCount: number;
  accountCreatedDate: string | null;
  accountUpdatedDate?: string | null;
  lastLogin: string | null;
};

type ArtistDetailResponse = {
  success: boolean;
  artist: ArtistDetail;
};

type ContentHistoryItem = {
  id: number;
  title: string;
  type: string;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  isApproved: boolean;
  createdAt: string;
};

type ContentHistoryResponse = {
  success: boolean;
  items?: ContentHistoryItem[];
  message?: string;
  correlationId?: string;
};

type DeleteResponse = {
  success: boolean;
  message?: string;
  correlationId?: string;
};

function PremiumPlayLogo() {
  return (
    <div className="h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#7d4a41] to-[#2d1b18] p-[2px]">
      <div className="h-full w-full rounded-full bg-[#1a1414]/80 border border-white/10 flex items-center justify-center">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9 7.5V16.5L17 12L9 7.5Z" fill="#b16e5b" />
        </svg>
      </div>
    </div>
  );
}

function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatJson(v: any) {
  if (v === null || v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

function formatPrice(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toFixed(2)} / month`;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[44px] items-center rounded-full border border-white/10 transition-colors ${
        checked ? "bg-[#243225]/70" : "bg-[#141010]/55"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-[#e6d6d2] shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export default function AdminArtistDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.id;
  const queryClient = useQueryClient();

  const lastLoadedArtistIdRef = useRef<string | null>(null);
  const artistFetchInFlightRef = useRef(false);
  const historyFetchInFlightRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftGenre, setDraftGenre] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftRevenueShare, setDraftRevenueShare] = useState("90");
  const [draftSubscriptionPrice, setDraftSubscriptionPrice] = useState("0");
  const [draftSocialLinks, setDraftSocialLinks] = useState("");
  const [draftAdminRemarks, setDraftAdminRemarks] = useState("");

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<ContentHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyBusyId, setHistoryBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContentHistoryItem | null>(null);

  const [historyTab, setHistoryTab] = useState<"AUDIO" | "VIDEO">("AUDIO");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "AUDIO_ONLY" | "VIDEO_ONLY">("ALL");
  const [previewItem, setPreviewItem] = useState<ContentHistoryItem | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_77cf67.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  const headerBannerStyle = useMemo(() => {
    if (artist?.bannerImage) {
      return {
        backgroundImage: `url(${artist.bannerImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      } as const;
    }

    return {
      backgroundImage:
        "linear-gradient(90deg, rgba(30,18,18,0.9) 0%, rgba(10,8,8,0.55) 55%, rgba(10,8,8,0.2) 100%)",
      backgroundSize: "cover"
    } as const;
  }, [artist?.bannerImage]);

  const fetchArtist = async (force = false) => {
    if (!artistId) return;
    if (!force) {
      if (artistFetchInFlightRef.current) return;
      if (lastLoadedArtistIdRef.current === artistId) return;
    }

    artistFetchInFlightRef.current = true;
    setLoading(true);
    try {
      const res = await http.get<ArtistDetailResponse>(`/api/v1/admin/artists/${artistId}`);
      const a = res.data.artist;
      setArtist(a);
      setDraftName(a?.name ?? "");
      setDraftPhone(a?.phone ?? "");
      setDraftGenre(a?.genre ?? "");
      setDraftBio(a?.bio ?? "");
      setDraftRevenueShare(String(a?.revenueSharePercentage ?? 90));
      setDraftSubscriptionPrice(String(a?.subscriptionPrice ?? 0));
      setDraftSocialLinks(formatJson(a?.socialLinks ?? null));
      setDraftAdminRemarks(a?.adminRemarks ?? "");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin/login", { replace: true });
        return;
      }
      if (status === 404) {
        navigate("/admin/artists", { replace: true });
        return;
      }
    } finally {
      setLoading(false);
      artistFetchInFlightRef.current = false;
      lastLoadedArtistIdRef.current = artistId;
    }
  };

  const fetchContentHistory = async (force = false) => {
    if (!artistId) return;
    if (!force && historyFetchInFlightRef.current) return;

    historyFetchInFlightRef.current = true;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await http.get<ContentHistoryResponse>("/api/v1/content/history", {
        params: {
          artistId
        }
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to fetch content history");
      }

      const raw = Array.isArray(res.data?.items) ? (res.data.items as any[]) : [];
      const next: ContentHistoryItem[] = raw.map((it: any) => {
        const thumbnailUrl = it?.thumbnailUrl ?? it?.thumbnail_url ?? null;
        const mediaUrl = it?.mediaUrl ?? it?.media_url ?? null;
        const audioUrl = it?.audioUrl ?? it?.audio_url ?? null;
        const videoUrl = it?.videoUrl ?? it?.video_url ?? null;

        return {
          id: Number(it?.id),
          title: (it?.title ?? "").toString(),
          type: (it?.type ?? "").toString(),
          thumbnailUrl,
          mediaUrl,
          audioUrl,
          videoUrl,
          isApproved: Boolean(it?.isApproved ?? it?.is_approved),
          createdAt: (it?.createdAt ?? it?.created_at ?? "").toString()
        };
      });

      setHistoryItems(next.filter((x) => Number.isFinite(x.id) && x.id > 0));
    } catch (e: any) {
      setHistoryError(e?.response?.data?.message || e?.message || "Failed to fetch content history");
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
      historyFetchInFlightRef.current = false;
    }
  };

  useEffect(() => {
    lastLoadedArtistIdRef.current = null;
    fetchArtist();
    fetchContentHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId]);

  useEffect(() => {
    if (!previewItem) return;
    const exists = historyItems.some((x) => x.id === previewItem.id);
    if (!exists) setPreviewItem(null);
  }, [historyItems, previewItem]);

  const baseUrl = useMemo(() => {
    return (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";
  }, []);

  const toAbsoluteUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (typeof url !== "string") return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const isAudioUrl = (url: string | null | undefined) => {
    if (!url) return false;
    if (typeof url !== "string") return false;
    const u = url.toLowerCase();
    return u.endsWith(".mp3") || u.endsWith(".wav") || u.endsWith(".m4a") || u.endsWith(".aac") || u.endsWith(".ogg");
  };

  const isVideoUrl = (url: string | null | undefined) => {
    if (!url) return false;
    if (typeof url !== "string") return false;
    const u = url.toLowerCase();
    return u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".mkv");
  };

  const hasAudioForItem = (item: ContentHistoryItem) => {
    return Boolean(item.audioUrl) || isAudioUrl(item.mediaUrl);
  };

  const hasVideoForItem = (item: ContentHistoryItem) => {
    return Boolean(item.videoUrl) || isVideoUrl(item.mediaUrl);
  };

  const getDisplayType = (item: ContentHistoryItem) => {
    const hasAudio = hasAudioForItem(item);
    const hasVideo = hasVideoForItem(item);
    if (hasAudio && hasVideo) return "DUAL";
    if (hasVideo) return "VIDEO";
    return "AUDIO";
  };

  const filteredHistoryItems = useMemo(() => {
    const tabKind = historyTab;
    return historyItems.filter((it) => {
      const hasAudio = hasAudioForItem(it);
      const hasVideo = hasVideoForItem(it);

      if (tabKind === "AUDIO" && !hasAudio) return false;
      if (tabKind === "VIDEO" && !hasVideo) return false;

      if (historyFilter === "AUDIO_ONLY") return hasAudio && !hasVideo;
      if (historyFilter === "VIDEO_ONLY") return hasVideo && !hasAudio;
      return true;
    });
  }, [historyFilter, historyItems, historyTab]);

  const deleteContent = async (item: ContentHistoryItem) => {
    setHistoryBusyId(item.id);
    setHistoryError(null);
    try {
      const res = await http.delete<DeleteResponse>(`/api/v1/content/${item.id}`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Delete failed");
      }

      setHistoryItems((prev) => prev.filter((x) => x.id !== item.id));
      setArtist((a) => {
        if (!a) return a;
        const nextCount = Math.max(0, Number(a.totalContentCount ?? 0) - 1);
        return { ...a, totalContentCount: nextCount };
      });
      setConfirmDelete(null);
    } catch (e: any) {
      setHistoryError(e?.response?.data?.message || e?.message || "Failed to delete content");
    } finally {
      setHistoryBusyId(null);
    }
  };

  const saveAll = async () => {
    if (!artistId) return;
    setBusy(true);
    setSaveError(null);
    try {
      const socialLinksObj = (() => {
        const raw = draftSocialLinks.trim();
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return undefined;
        }
      })();

      if (socialLinksObj === undefined) {
        setSaveError("Social Links must be valid JSON");
        return;
      }

      const res = await http.patch(`/api/v1/admin/artists/${artistId}`, {
        name: draftName || null,
        phone: draftPhone || null,
        genre: draftGenre || null,
        bio: draftBio || null,
        revenueSharePercentage: draftRevenueShare,
        subscriptionPrice: draftSubscriptionPrice,
        socialLinks: socialLinksObj,
        adminRemarks: draftAdminRemarks || null
      });

      if (res.data?.artist) {
        setArtist(res.data.artist);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to save changes";
      setSaveError(msg);
    } finally {
      setBusy(false);
    }
  };

  const setVerified = async (next: boolean) => {
    if (!artistId) return;
    setBusy(true);
    try {
      const res = await http.patch(`/api/v1/admin/artists/${artistId}/verified`, {
        isVerified: next
      });
      setArtist((a) => (a ? { ...a, isVerified: Boolean(res.data?.isVerified ?? next) } : a));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!artistId) throw new Error("Missing artist id");
      const res = await http.patch(`/api/v1/admin/artists/${artistId}/status`, {});
      const status = (res.data?.status ?? "").toString();
      return { status };
    },
    onMutate: async () => {
      const current = (artist?.status ?? "ACTIVE").toString().toUpperCase();
      const optimistic = current === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

      setBusy(true);
      setArtist((a) => (a ? { ...a, status: optimistic } : a));

      const numericId = Number(artistId);
      if (Number.isFinite(numericId)) {
        queryClient.setQueriesData(
          { queryKey: ["admin", "artists"], exact: false },
          (old: any) => {
            const items = old?.items;
            if (!Array.isArray(items)) return old;
            return {
              ...old,
              items: items.map((it: any) =>
                Number(it?.id) === numericId ? { ...it, status: optimistic } : it
              )
            };
          }
        );
      }

      return { previousStatus: current };
    },
    onError: (
      _err: unknown,
      _vars: void,
      ctx: { previousStatus: string } | undefined
    ) => {
      if (ctx?.previousStatus) {
        setArtist((a) => (a ? { ...a, status: ctx.previousStatus } : a));
      }
    },
    onSuccess: (data: { status: string }) => {
      const next = (data?.status ?? "").toString();
      if (next) setArtist((a) => (a ? { ...a, status: next } : a));
    },
    onSettled: () => {
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "artists"], exact: false });
    }
  });

  const status = (artist?.status ?? "ACTIVE").toUpperCase();
  const isSuspended = status === "SUSPENDED";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
          <div className="hidden">
            <PremiumPlayLogo />
          </div>

          <div className="mt-6 relative overflow-hidden rounded-[10px] border border-white/10 bg-[#1a1414]/35 shadow-[0_30px_70px_rgba(0,0,0,0.35)]">
            <div className="h-[240px] w-full" style={headerBannerStyle} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/65" />

            <div className="relative px-8 pb-7">
              <div className="-mt-[42px] flex items-end gap-6">
                <div className="h-[88px] w-[88px] rounded-[8px] border border-white/10 bg-[#2a1c1c] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                  {artist?.profileImage ? (
                    <img
                      src={artist.profileImage}
                      alt={artist.name ?? artist.email}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="pb-2">
                  <div className="text-[44px] leading-[46px] font-light tracking-wide text-[#e6d6d2]">
                    {loading ? "—" : artist?.name ?? "(No name)"}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3 text-[13px] text-[#cdbdb8]">
                <Toggle
                  checked={Boolean(artist?.isVerified)}
                  onChange={(v) => {
                    if (!busy) setVerified(v);
                  }}
                />
                <div className="flex items-center gap-2">
                  <span className="text-[#a99792]">Verified</span>
                  <span className="text-[#8d7b77]">{Boolean(artist?.isVerified) ? "ON" : "OFF"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Subscription Pricing</div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="h-[46px] rounded-[6px] border border-white/10 bg-[#141010]/35 px-5 flex items-center justify-between">
                      <div className="text-[18px] text-[#e6d6d2]">{formatPrice(artist?.subscriptionPrice ?? 0)}</div>
                      <div className="text-[12px] text-[#8d7b77]">Current</div>
                    </div>
                    <div>
                      <div className="text-[12px] text-[#a99792]">Update subscription price</div>
                      <input
                        value={draftSubscriptionPrice}
                        onChange={(e) => setDraftSubscriptionPrice(e.target.value)}
                        disabled={busy || loading}
                        className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder="0"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-[12px] text-[#8d7b77]">
                    Early Access 7 days before public release
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Professional Info</div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-[12px] text-[#a99792]">Genre</div>
                      <input
                        value={draftGenre}
                        onChange={(e) => setDraftGenre(e.target.value)}
                        disabled={busy || loading}
                        className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder="Hip-hop, Pop, Classical..."
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-[#a99792]">Social Links (JSON)</div>
                      <textarea
                        value={draftSocialLinks}
                        onChange={(e) => setDraftSocialLinks(e.target.value)}
                        disabled={busy || loading}
                        rows={6}
                        className="mt-2 w-full rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 py-2 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder='{"instagram":"https://...","spotify":"https://..."}'
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-[#a99792]">Revenue Share %</div>
                      <input
                        value={draftRevenueShare}
                        onChange={(e) => setDraftRevenueShare(e.target.value)}
                        disabled={busy || loading}
                        className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder="90"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Artist Status</div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={busy || loading}
                      onClick={() => {
                        if (!isSuspended) toggleStatusMutation.mutate();
                      }}
                      className={`h-[42px] rounded-[6px] border text-[14px] font-light tracking-wide shadow-[0_10px_25px_rgba(0,0,0,0.35)] ${
                        isSuspended
                          ? "border-white/10 bg-[#141010]/35 text-[#a99792]"
                          : "border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[#e6d6d2]"
                      }`}
                    >
                      Suspend
                    </button>

                    <button
                      type="button"
                      disabled={busy || loading}
                      onClick={() => {
                        if (isSuspended) toggleStatusMutation.mutate();
                      }}
                      className={`h-[42px] rounded-[6px] border text-[14px] font-light tracking-wide shadow-[0_10px_25px_rgba(0,0,0,0.35)] ${
                        isSuspended
                          ? "border-white/10 bg-gradient-to-b from-[#384038] to-[#202620] text-[#e6d6d2]"
                          : "border-white/10 bg-[#141010]/35 text-[#a99792]"
                      }`}
                    >
                      Activate
                    </button>
                  </div>

                  <div className="mt-4 text-[12px] text-[#8d7b77]">
                    Current status: <span className="text-[#d8c7c3]">{status}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] tracking-wide text-[#e6d6d2]">Content History</div>
                    <button
                      type="button"
                      disabled={historyLoading || loading}
                      onClick={() => fetchContentHistory(true)}
                      className="text-[12px] text-[#a99792] hover:text-[#e6d6d2] disabled:opacity-60"
                    >
                      Refresh
                    </button>
                  </div>

                  {historyError ? <div className="mt-3 text-[12px] text-[#e3a1a1]">{historyError}</div> : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryTab("AUDIO")}
                        className={`h-[30px] px-3 rounded-[6px] border text-[12px] tracking-wide transition-colors ${
                          historyTab === "AUDIO"
                            ? "border-white/15 bg-white/10 text-[#e6d6d2]"
                            : "border-white/10 bg-[#0e0a0a]/25 text-[#b8a6a1] hover:text-[#e6d6d2]"
                        }`}
                      >
                        Audio Content
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryTab("VIDEO")}
                        className={`h-[30px] px-3 rounded-[6px] border text-[12px] tracking-wide transition-colors ${
                          historyTab === "VIDEO"
                            ? "border-white/15 bg-white/10 text-[#e6d6d2]"
                            : "border-white/10 bg-[#0e0a0a]/25 text-[#b8a6a1] hover:text-[#e6d6d2]"
                        }`}
                      >
                        Video Content
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-[12px] text-[#a99792]">Filter</div>
                      <select
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value as any)}
                        className="h-[30px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[12px] text-[#e6d6d2] outline-none focus:border-white/20"
                      >
                        <option value="ALL">All</option>
                        <option value="AUDIO_ONLY">Audio Only</option>
                        <option value="VIDEO_ONLY">Video Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-white/10 rounded-[6px] border border-white/10 overflow-hidden">
                    {historyLoading ? (
                      <div className="px-5 py-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            <Skeleton className="h-[46px] w-[46px] rounded-[8px]" />
                            <div className="space-y-2 min-w-0">
                              <Skeleton className="h-[14px] w-[220px]" />
                              <Skeleton className="h-[12px] w-[160px]" />
                            </div>
                          </div>
                          <Skeleton className="h-[28px] w-[120px]" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            <Skeleton className="h-[46px] w-[46px] rounded-[8px]" />
                            <div className="space-y-2 min-w-0">
                              <Skeleton className="h-[14px] w-[200px]" />
                              <Skeleton className="h-[12px] w-[140px]" />
                            </div>
                          </div>
                          <Skeleton className="h-[28px] w-[120px]" />
                        </div>
                      </div>
                    ) : filteredHistoryItems.length === 0 ? (
                      <div className="px-5 py-4 text-[13px] text-[#b8a6a1]">No content items.</div>
                    ) : (
                      filteredHistoryItems.map((item) => {
                        const typeLabel = getDisplayType(item);
                        const approved = Boolean(item.isApproved);
                        const thumbSrc = toAbsoluteUrl(item.thumbnailUrl);
                        return (
                          <div key={item.id} className="bg-[#141010]/25 px-5 py-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="h-[46px] w-[46px] rounded-[8px] bg-[#0e0a0a]/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                  {thumbSrc ? (
                                    <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="text-[13px] text-[#e6d6d2] truncate">{item.title}</div>
                                  <div className="mt-1 flex items-center gap-2 text-[12px] text-[#a99792]">
                                    <span>{typeLabel}</span>
                                    <span className="text-[#7b6a66]">•</span>
                                    <span>{formatDateTime(item.createdAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={`inline-flex items-center rounded-[4px] border px-3 py-[4px] text-[12px] ${
                                    approved
                                      ? "bg-[#243225]/55 border-[#2b5a3b]/35 text-[#d9eadf]"
                                      : "bg-[#7a4b28]/45 border-[#c9853b]/25 text-[#d8b58a]"
                                  }`}
                                >
                                  {approved ? "Published" : "Pending Approval"}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setPreviewItem(item)}
                                  className="h-[32px] px-3 rounded-[6px] border border-white/10 bg-[#0e0a0a]/35 text-[12px] font-light text-[#d8c7c3] hover:text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
                                >
                                  Preview
                                </button>

                                <button
                                  type="button"
                                  disabled={historyBusyId === item.id}
                                  onClick={() => setConfirmDelete(item)}
                                  className="h-[32px] px-3 rounded-[6px] border border-[#6e2c2c]/40 bg-gradient-to-b from-[#5d1f1f] to-[#2f1212] text-[12px] font-light text-[#f0d2d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
                                >
                                  Delete Content
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

              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] tracking-wide text-[#e6d6d2]">About Artist</div>
                    <div className="text-[#7b6a66]">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 6H12.01"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 10V18"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-white/10 rounded-[6px] border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between bg-[#141010]/35 px-5 py-4">
                      <div className="text-[13px] text-[#a99792]">Account created</div>
                      <div className="text-[13px] text-[#d8c7c3] flex items-center gap-3">
                        {formatDateTime(artist?.accountCreatedDate ?? null)}
                        <span className="text-[#7b6a66]">›</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-[#141010]/25 px-5 py-4">
                      <div className="text-[13px] text-[#a99792]">Account updated</div>
                      <div className="text-[13px] text-[#d8c7c3] flex items-center gap-3">
                        {formatDateTime((artist as any)?.accountUpdatedDate ?? null)}
                        <span className="text-[#7b6a66]">›</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-[#141010]/25 px-5 py-4">
                      <div className="text-[13px] text-[#a99792]">Last login</div>
                      <div className="text-[13px] text-[#d8c7c3] flex items-center gap-3">
                        {formatDateTime(artist?.lastLogin ?? null)}
                        <span className="text-[#7b6a66]">›</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Profile Details</div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-[12px] text-[#a99792]">Name</div>
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        disabled={busy || loading}
                        className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder="Artist name"
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-[#a99792]">Phone</div>
                      <input
                        value={draftPhone}
                        onChange={(e) => setDraftPhone(e.target.value)}
                        disabled={busy || loading}
                        className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder="+1 555 123 4567"
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-[#a99792]">Bio</div>
                      <textarea
                        value={draftBio}
                        onChange={(e) => setDraftBio(e.target.value)}
                        disabled={busy || loading}
                        rows={4}
                        className="mt-2 w-full rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 py-2 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                        placeholder="Short bio"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[12px] text-[#8d7b77]">Editable by Admin</div>
                    <button
                      type="button"
                      disabled={busy || loading}
                      onClick={saveAll}
                      className="h-[36px] px-4 rounded-[6px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[13px] text-[#e6d6d2] disabled:opacity-60"
                    >
                      Save changes
                    </button>
                  </div>

                  {saveError ? <div className="mt-3 text-[12px] text-[#e3a1a1]">{saveError}</div> : null}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Management</div>
                  <div className="mt-4">
                    <div className="text-[12px] text-[#a99792]">Admin Remarks (private)</div>
                    <textarea
                      value={draftAdminRemarks}
                      onChange={(e) => setDraftAdminRemarks(e.target.value)}
                      disabled={busy || loading}
                      rows={5}
                      className="mt-2 w-full rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 py-2 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20 disabled:opacity-60"
                      placeholder="Internal notes visible only to admins"
                    />
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative px-6 py-5">
                  <div className="text-[14px] tracking-wide text-[#e6d6d2]">Audit Info</div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="rounded-[6px] border border-white/10 bg-[#141010]/30 px-5 py-4">
                      <div className="text-[12px] text-[#a99792]">Total content</div>
                      <div className="mt-1 text-[18px] font-light text-[#e6d6d2]">
                        {loading ? "—" : String(artist?.totalContentCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-[6px] border border-white/10 bg-[#141010]/30 px-5 py-4">
                      <div className="text-[12px] text-[#a99792]">Email</div>
                      <div className="mt-1 text-[13px] text-[#d8c7c3] break-all">
                        {loading ? "—" : artist?.email ?? ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link to="/admin/artists" className="text-[13px] text-[#b8a6a1] hover:text-white">
              ← Back to list
            </Link>
          </div>
        </div>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/65" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-[520px] rounded-[10px] border border-white/10 bg-[#141010]/95 backdrop-blur shadow-[0_30px_90px_rgba(0,0,0,0.75)]">
            <div className="px-6 py-5 border-b border-white/10">
              <div className="text-[15px] text-[#e6d6d2] tracking-wide">Confirm deletion</div>
              <div className="mt-2 text-[13px] text-[#b8a6a1]">
                Are you sure you want to remove this from Fan App?
              </div>
              <div className="mt-3 text-[13px] text-[#d8c7c3] truncate">{confirmDelete.title}</div>
            </div>

            <div className="px-6 py-5 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={historyBusyId === confirmDelete.id}
                onClick={() => setConfirmDelete(null)}
                className="h-[36px] px-4 rounded-[6px] border border-white/10 bg-[#0e0a0a]/35 text-[13px] text-[#d8c7c3] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={historyBusyId === confirmDelete.id}
                onClick={() => deleteContent(confirmDelete)}
                className="h-[36px] px-4 rounded-[6px] border border-[#6e2c2c]/40 bg-gradient-to-b from-[#5d1f1f] to-[#2f1212] text-[13px] font-light text-[#f0d2d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
              >
                {historyBusyId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/65" onClick={() => setPreviewItem(null)} />
          <div className="relative w-full max-w-[820px] rounded-[10px] border border-white/10 bg-[#141010]/95 backdrop-blur shadow-[0_30px_90px_rgba(0,0,0,0.75)]">
            <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[15px] text-[#e6d6d2] tracking-wide truncate">Preview Content</div>
                <div className="mt-2 text-[13px] text-[#d8c7c3] truncate">{previewItem.title}</div>
                <div className="mt-2 text-[12px] text-[#a99792]">
                  Type: <span className="text-[#e6d6d2]">{getDisplayType(previewItem)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="h-[34px] px-3 rounded-[6px] border border-white/10 bg-[#0e0a0a]/35 text-[12px] text-[#d8c7c3] hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5">
              {(() => {
                const hasAudio = hasAudioForItem(previewItem);
                const hasVideo = hasVideoForItem(previewItem);
                const audioSrc = toAbsoluteUrl(previewItem.audioUrl ?? previewItem.mediaUrl);
                const videoSrc = toAbsoluteUrl(previewItem.videoUrl ?? previewItem.mediaUrl);

                return (
                  <>
                    {!hasAudio || !hasVideo ? (
                      <div className="mb-4 rounded-[8px] border border-[#c9853b]/25 bg-[#7a4b28]/25 px-4 py-3 text-[12px] text-[#f2d6b6]">
                        {!hasAudio ? <div>Audio file missing for this post.</div> : null}
                        {!hasVideo ? <div>Video file missing for this post.</div> : null}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-[8px] border border-white/10 bg-[#0e0a0a]/35 p-4">
                        <div className="text-[13px] text-[#e6d6d2] tracking-wide">Audio Preview</div>
                        <div className="mt-3">
                          {hasAudio && audioSrc ? (
                            <audio src={audioSrc ?? undefined} controls className="w-full" />
                          ) : (
                            <div className="text-[12px] text-[#b8a6a1]">No audio available.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[8px] border border-white/10 bg-[#0e0a0a]/35 p-4">
                        <div className="text-[13px] text-[#e6d6d2] tracking-wide">Video Preview</div>
                        <div className="mt-3">
                          {hasVideo && videoSrc ? (
                            <video src={videoSrc ?? undefined} controls className="w-full max-h-[320px] rounded-[8px]" />
                          ) : (
                            <div className="text-[12px] text-[#b8a6a1]">No video available.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
