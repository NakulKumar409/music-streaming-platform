import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../services/http";
import { useQuery } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";

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

function CheckIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <div className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#243225]/60 border border-white/10">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 6L9 17L4 12"
            stroke="#9bd39b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#3a1b1b]/70 border border-white/10">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 6L6 18"
          stroke="#e3a1a1"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M6 6L18 18"
          stroke="#e3a1a1"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function formatPrice(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toFixed(2)}`;
}

export default function AdminArtistsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [apiError, setApiError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") || "1") || 1;
  const limit = 10;
  const filter = (searchParams.get("filter") || "").trim();
  const query = searchParams.get("search") || "";

  const [search, setSearch] = useState(query);
  const debounceRef = useRef<number | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_77cf67.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const artistsQueryKey = ["admin", "artists", { page, limit, filter: filter || "", search: query || "" }] as const;

  const artistsQuery = useQuery({
    queryKey: artistsQueryKey,
    queryFn: async () => {
      try {
        const res = await http.get<ArtistsListResponse>("/api/v1/admin/artists", {
          params: {
            page,
            limit,
            filter: filter || undefined,
            search: query || undefined
          }
        });
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
    placeholderData: (prev: ArtistsListResponse | undefined) => prev
  });

  const loading = artistsQuery.isLoading;
  const data = artistsQuery.data ?? null;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (artistsQuery.isError) {
      const e: any = artistsQuery.error;
      const errorMessage = e?.response?.data?.message || e?.message || "Failed to load artists";
      setApiError(errorMessage);
    } else {
      setApiError(null);
    }
  }, [artistsQuery.isError, artistsQuery.error]);

  const setPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    const nextParams: any = {};
    if (filter) nextParams.filter = filter;
    if (search.trim()) nextParams.search = search.trim();
    if (next !== 1) nextParams.page = String(next);
    setSearchParams(nextParams);
  };

  const onSearchChange = (v: string) => {
    setSearch(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const nextParams: any = {};
      if (filter) nextParams.filter = filter;
      const s = v.trim();
      if (s) nextParams.search = s;
      setSearchParams(nextParams);
    }, 250);
  };

  const setFilter = (nextFilter: string) => {
    const nextParams: any = {};
    const f = (nextFilter || "").trim();
    if (f) nextParams.filter = f;
    const s = search.trim();
    if (s) nextParams.search = s;
    setSearchParams(nextParams);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
          <div className="hidden">
            <PremiumPlayLogo />
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
            <div className="text-[40px] leading-[44px] font-light tracking-wide text-[#e0c7c0]">
              Artists
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className={`h-[34px] px-3 rounded-[6px] border text-[12px] tracking-wide transition-colors ${
                    !filter
                      ? "border-white/15 bg-white/10 text-[#e6d6d2]"
                      : "border-white/10 bg-[#141010]/35 text-[#b8a6a1] hover:text-[#e6d6d2]"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("inactive")}
                  className={`h-[34px] px-3 rounded-[6px] border text-[12px] tracking-wide transition-colors ${
                    filter.toLowerCase() === "inactive" || filter.toLowerCase() === "deleted"
                      ? "border-white/15 bg-white/10 text-[#e6d6d2]"
                      : "border-white/10 bg-[#141010]/35 text-[#b8a6a1] hover:text-[#e6d6d2]"
                  }`}
                >
                  Inactive
                </button>
              </div>
              <div className="relative w-full sm:max-w-[260px]">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e5c59]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 21L16.65 16.65"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </div>
                <input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search"
                  className="w-full h-[34px] rounded-[5px] bg-[#141010]/35 border border-white/10 pl-10 pr-3 text-[13px] text-[#d8c7c3] placeholder:text-[#6e5c59] outline-none focus:border-white/20"
                />
              </div>
            </div>
          </div>

          {apiError ? (
            <div className="mt-4 rounded-[6px] border border-[#e3a1a1]/25 bg-[#7a4b28]/30 px-4 py-3 text-[13px] text-[#e3a1a1]">
              Error: {apiError}
            </div>
          ) : null}

          <div className="mt-6 relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            <div className="relative">
              <div className="hidden md:grid grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-4 px-6 py-4 text-[12px] tracking-wide text-[#a99792] border-b border-white/10">
                <div>Name</div>
                <div>Verified</div>
                <div>Subscription Price</div>
                <div>Status</div>
                <div />
              </div>

              {loading ? (
                <div className="px-6 py-6 space-y-6 md:space-y-4">
                  <div className="flex flex-col md:grid md:grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-2 md:gap-4 items-start md:items-center pb-4 md:pb-0 border-b md:border-b-0 border-white/5 last:border-b-0">
                    <div className="space-y-2 w-full md:w-auto">
                      <Skeleton className="h-[14px] w-3/4 md:w-[180px]" />
                      <Skeleton className="h-[12px] w-1/2 md:w-[140px]" />
                    </div>
                    <Skeleton className="h-[22px] w-[22px] rounded-full hidden md:block" />
                    <Skeleton className="h-[14px] w-[90px] hidden md:block" />
                    <Skeleton className="h-[22px] w-[96px] hidden md:block" />
                    <Skeleton className="h-[14px] w-[90px] mt-2 md:mt-0" />
                  </div>
                  <div className="flex flex-col md:grid md:grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-2 md:gap-4 items-start md:items-center pb-4 md:pb-0 border-b md:border-b-0 border-white/5 last:border-b-0">
                    <div className="space-y-2 w-full md:w-auto">
                      <Skeleton className="h-[14px] w-3/4 md:w-[160px]" />
                      <Skeleton className="h-[12px] w-1/2 md:w-[120px]" />
                    </div>
                    <Skeleton className="h-[22px] w-[22px] rounded-full hidden md:block" />
                    <Skeleton className="h-[14px] w-[90px] hidden md:block" />
                    <Skeleton className="h-[22px] w-[96px] hidden md:block" />
                    <Skeleton className="h-[14px] w-[90px] mt-2 md:mt-0" />
                  </div>
                  <div className="flex flex-col md:grid md:grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-2 md:gap-4 items-start md:items-center pb-4 md:pb-0 border-b md:border-b-0 border-white/5 last:border-b-0">
                    <div className="space-y-2 w-full md:w-auto">
                      <Skeleton className="h-[14px] w-3/4 md:w-[200px]" />
                      <Skeleton className="h-[12px] w-1/2 md:w-[150px]" />
                    </div>
                    <Skeleton className="h-[22px] w-[22px] rounded-full hidden md:block" />
                    <Skeleton className="h-[14px] w-[90px] hidden md:block" />
                    <Skeleton className="h-[22px] w-[96px] hidden md:block" />
                    <Skeleton className="h-[14px] w-[90px] mt-2 md:mt-0" />
                  </div>
                </div>
              ) : (
                <div>
                  {items.map((a: ArtistListItem) => {
                    const status = (a.status || "ACTIVE").toUpperCase();
                    const isDeleted = Boolean((a as any).isDeleted);
                    const isInactive = isDeleted || status === "SUSPENDED";
                    return (
                      <div
                        key={a.id}
                        className="flex flex-col md:grid md:grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-3 md:gap-4 px-6 py-4 md:py-4 text-[13px] text-[#d8c7c3] border-b border-white/5 last:border-b-0"
                      >
                        <div className="flex items-center gap-3 w-full pb-2 md:pb-0">
                          <div className="h-[40px] w-[40px] md:h-[34px] md:w-[34px] rounded-full bg-[#2a1c1c] border border-white/10 overflow-hidden shrink-0">
                            {a.profileImage ? (
                              <img
                                src={a.profileImage}
                                alt={a.name ?? a.email}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[#e6d6d2] font-medium md:font-normal truncate">
                              {a.name ?? "(No name)"}
                            </div>
                            <div className="text-[12px] text-[#8d7b77] truncate">{a.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-start pt-2 md:pt-0 border-t border-white/5 md:border-0 hover:bg-white/5 md:hover:bg-transparent -mx-2 px-2 rounded-md md:rounded-none md:mx-0 md:px-0">
                          <span className="md:hidden text-[12px] text-[#a99792]">Verified</span>
                          <CheckIcon ok={Boolean(a.isVerified)} />
                        </div>

                        <div className="flex items-center justify-between md:justify-start py-1 md:py-0 hover:bg-white/5 md:hover:bg-transparent -mx-2 px-2 rounded-md md:rounded-none md:mx-0 md:px-0">
                          <span className="md:hidden text-[12px] text-[#a99792]">Subscription</span>
                          <span className="text-[#e6d6d2]">{formatPrice(a.subscriptionPrice)}</span>
                        </div>

                        <div className="flex items-center justify-between md:justify-start py-1 md:py-0 hover:bg-white/5 md:hover:bg-transparent -mx-2 px-2 rounded-md md:rounded-none md:mx-0 md:px-0">
                          <span className="md:hidden text-[12px] text-[#a99792]">Status</span>
                          <div>
                            {isInactive ? (
                              <span className="inline-flex items-center rounded-[4px] bg-[#3a1b1b]/55 border border-[#e3a1a1]/20 px-3 py-[3px] text-[12px] text-[#f0d2d2]">
                                Inactive
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-[4px] bg-[#243225]/45 border border-[#9bd39b]/20 px-3 py-[3px] text-[12px] text-[#bfe6bf]">
                                Active
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end md:justify-end pt-3 md:pt-0 mt-1 md:mt-0 border-t md:border-t-0 border-white/5">
                          <Link
                            to={`/admin/artists/${a.id}`}
                            className="w-full text-center md:w-auto h-[34px] md:h-auto flex items-center justify-center md:inline rounded-[6px] md:rounded-none bg-white/5 md:bg-transparent text-[13px] text-[#cdbdb8] hover:text-white hover:bg-white/10 md:hover:bg-transparent transition-colors"
                          >
                            View details
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {!items.length ? (
                    <div className="px-6 py-10 text-[13px] text-[#a99792]">No artists found.</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-[12px] text-[#8d7b77]">
              Total: {data?.totalCount ?? 0}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="h-[32px] px-3 rounded-[6px] border border-white/10 bg-[#141010]/35 text-[12px] text-[#d8c7c3] disabled:opacity-40"
              >
                Prev
              </button>
              <div className="text-[12px] text-[#a99792] px-2">
                {page} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="h-[32px] px-3 rounded-[6px] border border-white/10 bg-[#141010]/35 text-[12px] text-[#d8c7c3] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
