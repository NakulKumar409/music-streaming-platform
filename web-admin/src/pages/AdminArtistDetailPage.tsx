import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { http } from "../services/http";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";
import PageWrapper from "../components/PageWrapper";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Music,
  DollarSign,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  Trash2,
  RefreshCw,
  Eye,
  Play,
  Volume2,
  Calendar,
  Clock,
  Users,
  Award,
  Crown,
  Star,
  Shield,
  Settings,
  Activity,
  FileText,
  Link2,
  ExternalLink,
  Image,
  Video,
  AlertTriangle,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Zap,
  Sparkles,
} from "lucide-react";

type ArtistDetail = {
  id: number;
  name: string | null;
  email: string;
  profileImage: string | null;
  bannerImage: string | null;
  isVerified: boolean;
  subscriptionPrice: number;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletionReason?: string | null;
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

type SoftDeleteResponse = {
  success: boolean;
  artist?: {
    id: number;
    isDeleted?: boolean;
    deletedAt?: string | null;
    deletionReason?: string | null;
  };
  message?: string;
  correlationId?: string;
};

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
    second: "2-digit",
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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[24px] w-[48px] items-center rounded-full transition-all ${
        checked ? "bg-[#E85D2C]" : "bg-[#2A2A2A]"
      }`}>
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-lg transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function StatusBadge({
  status,
  isDeleted,
}: {
  status: string;
  isDeleted?: boolean;
}) {
  const isInactive = isDeleted || status === "SUSPENDED";

  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle size={12} />
        Inactive
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
      <CheckCircle size={12} />
      Active
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <CheckCircle size={12} />
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-[#8D7B77] border border-gray-500/20">
      <XCircle size={12} />
      Unverified
    </span>
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
  const [confirmDelete, setConfirmDelete] = useState<ContentHistoryItem | null>(
    null
  );

  const [softDeleteOpen, setSoftDeleteOpen] = useState(false);
  const [softDeleteReason, setSoftDeleteReason] = useState("");
  const [softDeleteBusy, setSoftDeleteBusy] = useState(false);
  const [softDeleteError, setSoftDeleteError] = useState<string | null>(null);

  const [historyTab, setHistoryTab] = useState<"AUDIO" | "VIDEO">("AUDIO");
  const [historyFilter, setHistoryFilter] = useState<
    "ALL" | "AUDIO_ONLY" | "VIDEO_ONLY"
  >("ALL");
  const [previewItem, setPreviewItem] = useState<ContentHistoryItem | null>(
    null
  );

  const headerBannerStyle = useMemo(() => {
    if (artist?.bannerImage) {
      return {
        backgroundImage: `url(${artist.bannerImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } as const;
    }
    return {
      backgroundImage:
        "linear-gradient(135deg, rgba(30,18,18,0.95) 0%, rgba(10,8,8,0.6) 55%, rgba(10,8,8,0.3) 100%)",
      backgroundSize: "cover",
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
      const res = await http.get<ArtistDetailResponse>(
        `/api/v1/admin/artists/${artistId}`
      );
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
      const res = await http.get<ContentHistoryResponse>(
        "/api/v1/content/history",
        {
          params: { artistId },
        }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to fetch content history");
      }

      const raw = Array.isArray(res.data?.items)
        ? (res.data.items as any[])
        : [];
      const next: ContentHistoryItem[] = raw.map((it: any) => ({
        id: Number(it?.id),
        title: (it?.title ?? "").toString(),
        type: (it?.type ?? "").toString(),
        thumbnailUrl: it?.thumbnailUrl ?? it?.thumbnail_url ?? null,
        mediaUrl: it?.mediaUrl ?? it?.media_url ?? null,
        audioUrl: it?.audioUrl ?? it?.audio_url ?? null,
        videoUrl: it?.videoUrl ?? it?.video_url ?? null,
        isApproved: Boolean(it?.isApproved ?? it?.is_approved),
        createdAt: (it?.createdAt ?? it?.created_at ?? "").toString(),
      }));

      setHistoryItems(next.filter((x) => Number.isFinite(x.id) && x.id > 0));
    } catch (e: any) {
      setHistoryError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch content history"
      );
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
  }, [artistId]);

  useEffect(() => {
    if (!previewItem) return;
    const exists = historyItems.some((x) => x.id === previewItem.id);
    if (!exists) setPreviewItem(null);
  }, [historyItems, previewItem]);

  const baseUrl = useMemo(() => {
    return (
      (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000"
    );
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
    return (
      u.endsWith(".mp3") ||
      u.endsWith(".wav") ||
      u.endsWith(".m4a") ||
      u.endsWith(".aac") ||
      u.endsWith(".ogg")
    );
  };

  const isVideoUrl = (url: string | null | undefined) => {
    if (!url) return false;
    if (typeof url !== "string") return false;
    const u = url.toLowerCase();
    return (
      u.endsWith(".mp4") ||
      u.endsWith(".webm") ||
      u.endsWith(".mov") ||
      u.endsWith(".mkv")
    );
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
      const res = await http.delete<DeleteResponse>(
        `/api/v1/content/${item.id}`
      );
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
      setHistoryError(
        e?.response?.data?.message || e?.message || "Failed to delete content"
      );
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
        adminRemarks: draftAdminRemarks || null,
      });

      if (res.data?.artist) {
        setArtist(res.data.artist);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Failed to save changes";
      setSaveError(msg);
    } finally {
      setBusy(false);
    }
  };

  const setVerified = async (next: boolean) => {
    if (!artistId) return;
    setBusy(true);
    try {
      const res = await http.patch(
        `/api/v1/admin/artists/${artistId}/verified`,
        {
          isVerified: next,
        }
      );
      setArtist((a) =>
        a ? { ...a, isVerified: Boolean(res.data?.isVerified ?? next) } : a
      );
    } finally {
      setBusy(false);
    }
  };

  const submitSoftDelete = async () => {
    if (!artistId) return;
    const reason = softDeleteReason.trim();
    if (!reason) {
      setSoftDeleteError("Reason is required");
      return;
    }

    setSoftDeleteBusy(true);
    setSoftDeleteError(null);
    try {
      const res = await http.patch<SoftDeleteResponse>(
        `/api/v1/admin/artists/${artistId}/soft-delete`,
        { reason }
      );
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Soft delete failed");
      }
      setArtist((a) => {
        if (!a) return a;
        return {
          ...a,
          isDeleted: Boolean(res.data?.artist?.isDeleted ?? true),
          deletedAt: (res.data?.artist?.deletedAt ?? null) as any,
          deletionReason: (res.data?.artist?.deletionReason ?? reason) as any,
        };
      });
      setSoftDeleteOpen(false);
      setSoftDeleteReason("");
      queryClient.invalidateQueries({
        queryKey: ["admin", "artists"],
        exact: false,
      });
    } catch (e: any) {
      setSoftDeleteError(
        e?.response?.data?.message || e?.message || "Soft delete failed"
      );
    } finally {
      setSoftDeleteBusy(false);
    }
  };

  const reactivateArtist = async () => {
    if (!artistId) return;
    setSoftDeleteBusy(true);
    setSoftDeleteError(null);
    try {
      const res = await http.patch<SoftDeleteResponse>(
        `/api/v1/admin/artists/${artistId}/reactivate`,
        {}
      );
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Reactivation failed");
      }
      setArtist((a) => {
        if (!a) return a;
        return {
          ...a,
          isDeleted: Boolean(res.data?.artist?.isDeleted ?? false),
          deletedAt: (res.data?.artist?.deletedAt ?? null) as any,
          deletionReason: (res.data?.artist?.deletionReason ?? null) as any,
        };
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "artists"],
        exact: false,
      });
    } catch (e: any) {
      setSoftDeleteError(
        e?.response?.data?.message || e?.message || "Reactivation failed"
      );
    } finally {
      setSoftDeleteBusy(false);
    }
  };

  const status = (artist?.status ?? "ACTIVE").toString().toUpperCase();
  const isDeleted = Boolean((artist as any)?.isDeleted);
  const isInactive = isDeleted || status === "SUSPENDED";
  const statusLabel = isInactive ? "DEACTIVATED" : "ACTIVE";

  if (loading) {
    return (
      <PageWrapper
        title="Artist Details"
        subtitle="Loading artist information...">
        <div className="space-y-4">
          <Skeleton className="h-[240px] w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Artist Details"
      subtitle={`Managing ${artist?.name || "Artist"}`}>
      {/* Back Button */}
      <Link
        to="/admin/artists"
        className="inline-flex items-center gap-2 text-sm text-[#8D7B77] hover:text-white transition-all mb-6">
        <ArrowLeft size={16} />
        Back to Artists
      </Link>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E]">
        <div className="h-[200px] w-full" style={headerBannerStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/65" />

        <div className="relative px-6 pb-6 -mt-12">
          <div className="flex items-end gap-6">
            <div className="h-[88px] w-[88px] rounded-2xl border-2 border-white/10 bg-[#0A0A0A] overflow-hidden shadow-xl">
              {artist?.profileImage ? (
                <img
                  src={artist.profileImage}
                  alt={artist.name ?? artist.email}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[#8D7B77]">
                  <User size={32} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-bold text-white truncate">
                  {artist?.name ?? "Unnamed Artist"}
                </h1>
                <VerifiedBadge verified={Boolean(artist?.isVerified)} />
                <StatusBadge status={status} isDeleted={isDeleted} />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Mail size={14} className="text-[#8D7B77]" />
                <span className="text-sm text-[#8D7B77]">{artist?.email}</span>
                {artist?.phone && (
                  <>
                    <span className="text-[#8D7B77]">•</span>
                    <Phone size={14} className="text-[#8D7B77]" />
                    <span className="text-sm text-[#8D7B77]">
                      {artist.phone}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pb-2">
              <Toggle
                checked={Boolean(artist?.isVerified)}
                onChange={(v) => {
                  if (!busy) setVerified(v);
                }}
              />
              <span className="text-xs text-[#8D7B77]">
                {Boolean(artist?.isVerified) ? "Verified" : "Verify"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Subscription Pricing */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#E85D2C]/10">
                <DollarSign size={18} className="text-[#E85D2C]" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Subscription Pricing
              </h3>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
              <span className="text-sm text-[#8D7B77]">Current Price</span>
              <span className="text-lg font-bold text-white">
                {formatPrice(artist?.subscriptionPrice ?? 0)}
              </span>
            </div>

            <div className="mt-4">
              <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                Update Price
              </label>
              <input
                value={draftSubscriptionPrice}
                onChange={(e) => setDraftSubscriptionPrice(e.target.value)}
                disabled={busy}
                className="mt-1.5 w-full h-[42px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50"
                placeholder="0"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Professional Info */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Music size={18} className="text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Professional Info
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                  Genre
                </label>
                <input
                  value={draftGenre}
                  onChange={(e) => setDraftGenre(e.target.value)}
                  disabled={busy}
                  className="mt-1.5 w-full h-[42px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50"
                  placeholder="Hip-hop, Pop, Classical..."
                />
              </div>

              <div>
                <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                  Revenue Share %
                </label>
                <input
                  value={draftRevenueShare}
                  onChange={(e) => setDraftRevenueShare(e.target.value)}
                  disabled={busy}
                  className="mt-1.5 w-full h-[42px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50"
                  placeholder="90"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                  Social Links (JSON)
                </label>
                <textarea
                  value={draftSocialLinks}
                  onChange={(e) => setDraftSocialLinks(e.target.value)}
                  disabled={busy}
                  rows={4}
                  className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50 resize-none"
                  placeholder='{"instagram":"https://...","spotify":"https://..."}'
                />
              </div>
            </div>
          </div>

          {/* Artist Status */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <Shield size={18} className="text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Artist Status
              </h3>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy || softDeleteBusy || isInactive}
                onClick={() => {
                  setSoftDeleteError(null);
                  setSoftDeleteOpen(true);
                }}
                className={`flex-1 h-[42px] rounded-xl border text-sm font-medium transition-all ${
                  isInactive
                    ? "border-white/10 bg-white/5 text-[#8D7B77] cursor-not-allowed"
                    : "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
                }`}>
                <Trash2 size={16} className="inline mr-2" />
                Deactivate
              </button>

              <button
                type="button"
                disabled={busy || softDeleteBusy || !isInactive}
                onClick={reactivateArtist}
                className={`flex-1 h-[42px] rounded-xl border text-sm font-medium transition-all ${
                  isInactive
                    ? "border-green-500/20 bg-green-500/5 text-green-400 hover:bg-green-500/10"
                    : "border-white/10 bg-white/5 text-[#8D7B77] cursor-not-allowed"
                }`}>
                <RefreshCw size={16} className="inline mr-2" />
                Reactivate
              </button>
            </div>

            <div className="mt-3 text-xs text-[#8D7B77]">
              Current Status:{" "}
              <span
                className={`font-medium ${
                  isInactive ? "text-red-400" : "text-green-400"
                }`}>
                {statusLabel}
              </span>
            </div>

            {isInactive && isDeleted && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <p className="text-xs text-red-400">Account deactivated</p>
                {(artist as any)?.deletedAt && (
                  <p className="text-xs text-[#8D7B77] mt-1">
                    Deleted: {formatDateTime((artist as any)?.deletedAt)}
                  </p>
                )}
                {(artist as any)?.deletionReason && (
                  <p className="text-xs text-[#8D7B77] mt-0.5">
                    Reason: {(artist as any)?.deletionReason}
                  </p>
                )}
              </div>
            )}

            {softDeleteError && (
              <div className="mt-2 text-xs text-red-400">{softDeleteError}</div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Content History */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <FileText size={18} className="text-green-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Content History
                </h3>
              </div>
              <button
                type="button"
                disabled={historyLoading}
                onClick={() => fetchContentHistory(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-[#8D7B77] hover:text-white transition-all">
                <RefreshCw
                  size={12}
                  className={historyLoading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            {historyError && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                {historyError}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setHistoryTab("AUDIO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  historyTab === "AUDIO"
                    ? "bg-[#E85D2C]/10 text-[#E85D2C] border border-[#E85D2C]/20"
                    : "text-[#8D7B77] hover:text-white"
                }`}>
                <Volume2 size={12} className="inline mr-1" />
                Audio
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab("VIDEO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  historyTab === "VIDEO"
                    ? "bg-[#E85D2C]/10 text-[#E85D2C] border border-[#E85D2C]/20"
                    : "text-[#8D7B77] hover:text-white"
                }`}>
                <Video size={12} className="inline mr-1" />
                Video
              </button>

              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as any)}
                className="ml-auto h-[30px] rounded-lg bg-black/30 border border-white/10 px-2 text-xs text-white outline-none focus:border-[#E85D2C]/50">
                <option value="ALL">All</option>
                <option value="AUDIO_ONLY">Audio Only</option>
                <option value="VIDEO_ONLY">Video Only</option>
              </select>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {historyLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <Skeleton className="h-[46px] w-[46px] rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2 w-20 mt-1" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))
              ) : filteredHistoryItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[#8D7B77]">No content found</p>
                </div>
              ) : (
                filteredHistoryItems.map((item) => {
                  const typeLabel = getDisplayType(item);
                  const approved = Boolean(item.isApproved);
                  const thumbSrc = toAbsoluteUrl(item.thumbnailUrl);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#E85D2C]/30 transition-all">
                      <div className="h-[46px] w-[46px] rounded-xl bg-black/30 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileText size={18} className="text-[#8D7B77]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[#8D7B77]">
                            {typeLabel}
                          </span>
                          <span className="text-[#8D7B77]">•</span>
                          <span
                            className={`text-xs ${
                              approved ? "text-green-400" : "text-yellow-400"
                            }`}>
                            {approved ? "Published" : "Pending"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-all text-[#8D7B77] hover:text-white"
                          title="Preview">
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={historyBusyId === item.id}
                          onClick={() => setConfirmDelete(item)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all text-red-400"
                          title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* About Artist */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-yellow-500/10">
                <User size={18} className="text-yellow-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">About Artist</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                <span className="text-xs text-[#8D7B77]">Account Created</span>
                <span className="text-sm text-white">
                  {formatDateTime(artist?.accountCreatedDate)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                <span className="text-xs text-[#8D7B77]">Last Login</span>
                <span className="text-sm text-white">
                  {formatDateTime(artist?.lastLogin)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                <span className="text-xs text-[#8D7B77]">Total Content</span>
                <span className="text-sm font-bold text-white">
                  {artist?.totalContentCount ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-pink-500/10">
                <Edit size={18} className="text-pink-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Profile Details
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                  Name
                </label>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  disabled={busy}
                  className="mt-1.5 w-full h-[42px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50"
                  placeholder="Artist name"
                />
              </div>
              <div>
                <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                  Phone
                </label>
                <input
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  disabled={busy}
                  className="mt-1.5 w-full h-[42px] rounded-xl bg-black/30 border border-white/10 px-4 text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50"
                  placeholder="+1 555 123 4567"
                />
              </div>
              <div>
                <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                  Bio
                </label>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  disabled={busy}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50 resize-none"
                  placeholder="Short bio"
                />
              </div>
            </div>

            {saveError && (
              <div className="mt-3 text-xs text-red-400">{saveError}</div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={saveAll}
              className="mt-4 w-full h-[42px] rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-white font-medium hover:shadow-lg hover:shadow-[#E85D2C]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={16} />
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {/* Admin Remarks */}
          <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-orange-500/10">
                <Settings size={18} className="text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Admin Remarks
              </h3>
            </div>

            <textarea
              value={draftAdminRemarks}
              onChange={(e) => setDraftAdminRemarks(e.target.value)}
              disabled={busy}
              rows={4}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50 resize-none"
              placeholder="Internal notes visible only to admins..."
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#15100E] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Confirm Deletion
              </h3>
            </div>
            <p className="text-sm text-[#8D7B77]">
              Are you sure you want to delete this content?
            </p>
            <p className="text-sm text-white mt-1 font-medium">
              {confirmDelete.title}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-[42px] rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white transition-all">
                Cancel
              </button>
              <button
                type="button"
                disabled={historyBusyId === confirmDelete.id}
                onClick={() => deleteContent(confirmDelete)}
                className="flex-1 h-[42px] rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-all disabled:opacity-50">
                {historyBusyId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewItem(null)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#15100E] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {previewItem.title}
                </h3>
                <p className="text-sm text-[#8D7B77]">
                  Type: {getDisplayType(previewItem)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-xl hover:bg-white/10 transition-all">
                <XCircle size={20} className="text-[#8D7B77]" />
              </button>
            </div>

            <div className="space-y-4">
              {hasAudioForItem(previewItem) && (
                <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                  <p className="text-xs text-[#8D7B77] mb-2">Audio Preview</p>
                  <audio
                    src={
                      toAbsoluteUrl(
                        previewItem.audioUrl ?? previewItem.mediaUrl
                      ) ?? undefined
                    }
                    controls
                    className="w-full"
                  />
                </div>
              )}
              {hasVideoForItem(previewItem) && (
                <div className="rounded-xl bg-black/30 border border-white/5 p-4">
                  <p className="text-xs text-[#8D7B77] mb-2">Video Preview</p>
                  <video
                    src={
                      toAbsoluteUrl(
                        previewItem.videoUrl ?? previewItem.mediaUrl
                      ) ?? undefined
                    }
                    controls
                    className="w-full rounded-lg max-h-[320px]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Soft Delete Modal */}
      {softDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!softDeleteBusy) setSoftDeleteOpen(false);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#15100E] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Deactivate Artist
              </h3>
            </div>
            <p className="text-sm text-[#8D7B77]">
              This will hide the artist and all content from the Fan App
              immediately.
            </p>

            <div className="mt-4">
              <label className="text-xs text-[#8D7B77] uppercase tracking-wider">
                Reason (required)
              </label>
              <textarea
                value={softDeleteReason}
                onChange={(e) => setSoftDeleteReason(e.target.value)}
                disabled={softDeleteBusy}
                rows={3}
                className="mt-1.5 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:border-[#E85D2C]/50 transition-all disabled:opacity-50 resize-none"
                placeholder="e.g. Policy violation, requested deactivation..."
              />
              {softDeleteError && (
                <div className="mt-1.5 text-xs text-red-400">
                  {softDeleteError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                disabled={softDeleteBusy}
                onClick={() => setSoftDeleteOpen(false)}
                className="flex-1 h-[42px] rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white transition-all disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={softDeleteBusy}
                onClick={submitSoftDelete}
                className="flex-1 h-[42px] rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-all disabled:opacity-50">
                {softDeleteBusy ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
