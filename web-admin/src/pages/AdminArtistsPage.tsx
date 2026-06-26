import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";
import { getOptimizedImageUrl } from "../services/cloudinary";
import Skeleton from "../components/Skeleton";
import PageWrapper from "../components/PageWrapper";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  Star,
  DollarSign,
  User,
  Mail,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  RefreshCw,
  Filter,
  TrendingUp,
  Music,
  UserPlus,
  MoreHorizontal,
} from "lucide-react";

type ArtistListItem = {
  id: number;
  name: string | null;
  email: string;
  profileImage: string | null;
  isVerified: boolean;
  subscriptionPrice: number;
  status: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletionReason?: string | null;
};

type ArtistsListResponse = {
  success: boolean;
  items: ArtistListItem[];
  totalCount: number;
  totalPages: number;
};

function StatusBadge({
  status,
  isDeleted,
}: {
  status: string;
  isDeleted?: boolean;
}) {
  const isInactive =
    isDeleted || status === "SUSPENDED" || status === "INACTIVE";

  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <UserX size={12} />
        Inactive
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
      <UserCheck size={12} />
      Active
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <CheckCircle size={12} />
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-[#8D7B77] border border-gray-500/20">
      <XCircle size={12} />
      Unverified
    </span>
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
        <span className="text-white font-semibold">{totalItems}</span> artists
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

export default function AdminArtistsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const formatPrice = useCallback((n: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "$0.00";
    return `$${v.toFixed(2)}`;
  }, []);

  const [apiError, setApiError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") || "1") || 1;
  const limit = 10;
  const filter = (searchParams.get("filter") || "").trim();
  const query = searchParams.get("search") || "";

  const [search, setSearch] = useState(query);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const artistsQueryKey = [
    "admin",
    "artists",
    { page, limit, filter: filter || "", search: query || "" },
  ] as const;

  const artistsQuery = useQuery({
    queryKey: artistsQueryKey,
    queryFn: async () => {
      try {
        const res = await http.get<ArtistsListResponse>(
          "/api/v1/admin/artists",
          {
            params: {
              page,
              limit,
              filter: filter || undefined,
              search: query || undefined,
            },
          }
        );
        return res.data;
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem("adminToken");
          navigate("/admin/login", { replace: true });
        }
        throw e;
      }
    },
    placeholderData: (prev: ArtistsListResponse | undefined) => prev,
  });

  const loading = artistsQuery.isLoading;
  const data = artistsQuery.data ?? null;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    if (artistsQuery.isError) {
      const e: any = artistsQuery.error;
      const errorMessage =
        e?.response?.data?.message || e?.message || "Failed to load artists";
      setApiError(errorMessage);
    } else {
      setApiError(null);
    }
  }, [artistsQuery.isError, artistsQuery.error]);

  const setPage = useCallback(
    (p: number) => {
      const next = Math.max(1, Math.min(totalPages, p));
      const nextParams: any = {};
      if (filter) nextParams.filter = filter;
      if (search.trim()) nextParams.search = search.trim();
      if (next !== 1) nextParams.page = String(next);
      setSearchParams(nextParams);
    },
    [totalPages, filter, search, setSearchParams]
  );

  const onSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const nextParams: any = {};
        if (filter) nextParams.filter = filter;
        const s = v.trim();
        if (s) nextParams.search = s;
        setSearchParams(nextParams);
      }, 250);
    },
    [filter, setSearchParams]
  );

  const setFilter = useCallback(
    (nextFilter: string) => {
      const nextParams: any = {};
      const f = (nextFilter || "").trim();
      if (f) nextParams.filter = f;
      const s = search.trim();
      if (s) nextParams.search = s;
      setSearchParams(nextParams);
    },
    [search, setSearchParams]
  );

  return (
    <PageWrapper title="Artists" subtitle="Manage all artists on your platform">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-white/5 bg-[#15100E] p-4">
          <div className="flex items-center gap-2 text-[#8D7B77] text-xs">
            Total Artists
          </div>
          <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#15100E] p-4">
          <div className="flex items-center gap-2 text-[#8D7B77] text-xs">
            <UserCheck size={14} className="text-green-400" />
            Active
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {
              items.filter((a) => !a.isDeleted && a.status !== "SUSPENDED")
                .length
            }
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#15100E] p-4">
          <div className="flex items-center gap-2 text-[#8D7B77] text-xs">
            <UserX size={14} className="text-red-400" />
            Inactive
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {
              items.filter((a) => a.isDeleted || a.status === "SUSPENDED")
                .length
            }
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#15100E] p-4">
          <div className="flex items-center gap-2 text-[#8D7B77] text-xs">
            <CheckCircle size={14} className="text-blue-400" />
            Verified
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {items.filter((a) => a.isVerified).length}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`h-[38px] px-4 rounded-xl border text-sm font-medium transition-all ${
              !filter
                ? "border-[#E85D2C]/20 bg-[#E85D2C]/10 text-[#E85D2C]"
                : "border-white/10 bg-white/5 text-[#8D7B77] hover:text-white hover:bg-white/10"
            }`}>
            <UserCheck size={14} className="inline mr-2" />
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`h-[38px] px-4 rounded-xl border text-sm font-medium transition-all ${
              filter === "active"
                ? "border-[#E85D2C]/20 bg-[#E85D2C]/10 text-[#E85D2C]"
                : "border-white/10 bg-white/5 text-[#8D7B77] hover:text-white hover:bg-white/10"
            }`}>
            <UserCheck size={14} className="inline mr-2" />
            Active
          </button>
          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={`h-[38px] px-4 rounded-xl border text-sm font-medium transition-all ${
              filter === "inactive"
                ? "border-[#E85D2C]/20 bg-[#E85D2C]/10 text-[#E85D2C]"
                : "border-white/10 bg-white/5 text-[#8D7B77] hover:text-white hover:bg-white/10"
            }`}>
            <UserX size={14} className="inline mr-2" />
            Inactive
          </button>
          <button
            type="button"
            onClick={() => setFilter("verified")}
            className={`h-[38px] px-4 rounded-xl border text-sm font-medium transition-all ${
              filter === "verified"
                ? "border-[#E85D2C]/20 bg-[#E85D2C]/10 text-[#E85D2C]"
                : "border-white/10 bg-white/5 text-[#8D7B77] hover:text-white hover:bg-white/10"
            }`}>
            <CheckCircle size={14} className="inline mr-2" />
            Verified
          </button>
        </div>

        <div className="relative w-full sm:w-[280px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D7B77]"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search artists..."
            className="w-full h-[38px] rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 text-sm text-white placeholder:text-[#8D7B77] outline-none focus:border-[#E85D2C]/50 transition-all"
          />
        </div>
      </div>

      {/* Error */}
      {apiError && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-center gap-3">
          <XCircle size={18} className="text-red-400" />
          <span className="text-sm text-red-100/80">{apiError}</span>
        </div>
      )}

      {/* Artists Table */}
      <div className="rounded-2xl border border-white/5 bg-[#15100E] overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 px-6 py-4 text-xs font-medium text-[#8D7B77] uppercase tracking-wider border-b border-white/5 bg-white/5">
          <div>Artist</div>
          <div>Verified</div>
          <div>Price</div>
          <div>Status</div>
          <div className="text-right">Action</div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="px-6 py-6 space-y-6 md:space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col md:grid md:grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 items-start md:items-center">
                <div className="flex items-center gap-3 w-full">
                  <Skeleton className="h-[40px] w-[40px] rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-xl ml-auto" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-3">
              <Users size={24} className="text-[#8D7B77]" />
            </div>
            <p className="text-sm font-medium text-white">No artists found</p>
            <p className="text-xs text-[#8D7B77] mt-1">
              Try adjusting your filters or search
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((a: ArtistListItem) => {
              const status = (a.status || "ACTIVE").toUpperCase();
              const isDeleted = Boolean((a as any).isDeleted);
              return (
                <div
                  key={a.id}
                  className="flex flex-col md:grid md:grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 px-6 py-4 items-start md:items-center hover:bg-white/5 transition-all">
                  {/* Artist Info */}
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-[40px] w-[40px] rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0">
                      {a.profileImage ? (
                        <img
                          src={getOptimizedImageUrl(a.profileImage)}
                          alt={a.name ?? a.email}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#8D7B77]">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {a.name ?? "Unnamed Artist"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail size={12} className="text-[#8D7B77]" />
                        <span className="text-xs text-[#8D7B77] truncate">
                          {a.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Verified */}
                  <VerifiedBadge verified={Boolean(a.isVerified)} />

                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-[#E85D2C]" />
                    <span className="text-sm text-white">
                      {formatPrice(a.subscriptionPrice)}
                    </span>
                  </div>

                  {/* Status */}
                  <StatusBadge status={status} isDeleted={isDeleted} />

                  {/* Action */}
                  <div className="flex items-center justify-end w-full md:w-auto">
                    <Link
                      to={`/admin/artists/${a.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white hover:bg-white/10 transition-all">
                      <Eye size={14} />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Premium Pagination */}
        {totalCount > 0 && (
          <PremiumPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={limit}
            onPageChange={setPage}
          />
        )}
      </div>
    </PageWrapper>
  );
}
