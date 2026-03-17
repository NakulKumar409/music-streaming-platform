import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../services/http";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "../components/Skeleton";

type ArtistListItem = {
  id: number;
  name: string | null;
  email: string;
  profileImage: string | null;
  isVerified: boolean;
  subscriptionPrice: number;
  status: string;
};

type ArtistsListResponse = {
  success: boolean;
  items: ArtistListItem[];
  totalCount: number;
  totalPages: number;
};

type CreateArtistResponse = {
  success: boolean;
  artist?: {
    id: number | null;
    name: string | null;
    email: string;
    role: string;
    status: string;
    isVerified: boolean;
    phone?: string | null;
    genre?: string | null;
    subscriptionPrice?: number;
  };
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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createGenre, setCreateGenre] = useState("");
  const [createSubscriptionPrice, setCreateSubscriptionPrice] = useState("0");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const onCreateArtist = async () => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await http.post<CreateArtistResponse>("/api/v1/admin/artists/create", {
        name: createName || null,
        email: createEmail,
        temporaryPassword: createPassword,
        phone: createPhone || null,
        genre: createGenre || null,
        subscriptionPrice: createSubscriptionPrice
      });

      if (!res.data?.success) {
        setCreateError(res.data?.artist ? "Failed to create artist" : "Request failed");
        return;
      }

      const a = res.data.artist;
      if (a) {
        const mapped: ArtistListItem = {
          id: a.id ?? 0,
          name: a.name,
          email: a.email,
          profileImage: null,
          isVerified: Boolean(a.isVerified),
          subscriptionPrice: Number(a.subscriptionPrice ?? 0),
          status: a.status
        };

        queryClient.setQueryData<ArtistsListResponse>(artistsQueryKey, (prev: ArtistsListResponse | undefined) => {
          if (!prev) {
            return {
              success: true,
              items: [mapped],
              totalCount: 1,
              totalPages: 1
            };
          }

          return {
            ...prev,
            items: [mapped, ...prev.items],
            totalCount: (prev.totalCount ?? 0) + 1
          };
        });
      }

      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreatePhone("");
      setCreateGenre("");
      setCreateSubscriptionPrice("0");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to create artist";
      setCreateError(msg);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PremiumPlayLogo />
              <Link
                to="/admin/home"
                className="text-[13px] text-[#b8a6a1] hover:text-white"
              >
                Admin Home
              </Link>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 text-[13px] text-[#d8c7c3] hover:text-white"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>Admin</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 9L12 15L18 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-3 w-[180px] rounded-[6px] border border-white/10 bg-[#141010]/90 backdrop-blur px-2 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-[13px] text-[#d8c7c3] hover:bg-white/5 rounded-[4px]"
                    onClick={() => {
                      localStorage.removeItem("adminToken");
                      navigate("/admin/login", { replace: true });
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between">
            <div className="text-[40px] leading-[44px] font-light tracking-wide text-[#e0c7c0]">
              Artists
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-full max-w-[260px]">
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

              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="h-[36px] px-4 rounded-[6px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[13px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
              >
                Create artist
              </button>
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
              <div className="grid grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-4 px-6 py-4 text-[12px] tracking-wide text-[#a99792] border-b border-white/10">
                <div>Name</div>
                <div>Verified</div>
                <div>Subscription Price</div>
                <div>Status</div>
                <div />
              </div>

              {loading ? (
                <div className="px-6 py-6 space-y-4">
                  <div className="grid grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-4 items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-[14px] w-[180px]" />
                      <Skeleton className="h-[12px] w-[140px]" />
                    </div>
                    <Skeleton className="h-[22px] w-[22px] rounded-full" />
                    <Skeleton className="h-[14px] w-[90px]" />
                    <Skeleton className="h-[22px] w-[96px]" />
                    <Skeleton className="h-[14px] w-[90px]" />
                  </div>
                  <div className="grid grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-4 items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-[14px] w-[160px]" />
                      <Skeleton className="h-[12px] w-[120px]" />
                    </div>
                    <Skeleton className="h-[22px] w-[22px] rounded-full" />
                    <Skeleton className="h-[14px] w-[90px]" />
                    <Skeleton className="h-[22px] w-[96px]" />
                    <Skeleton className="h-[14px] w-[90px]" />
                  </div>
                  <div className="grid grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-4 items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-[14px] w-[200px]" />
                      <Skeleton className="h-[12px] w-[150px]" />
                    </div>
                    <Skeleton className="h-[22px] w-[22px] rounded-full" />
                    <Skeleton className="h-[14px] w-[90px]" />
                    <Skeleton className="h-[22px] w-[96px]" />
                    <Skeleton className="h-[14px] w-[90px]" />
                  </div>
                </div>
              ) : (
                <div>
                  {items.map((a: ArtistListItem) => {
                    const status = (a.status || "ACTIVE").toUpperCase();
                    const isSuspended = status === "SUSPENDED";
                    return (
                      <div
                        key={a.id}
                        className="grid grid-cols-[1.6fr_0.7fr_1fr_0.9fr_0.8fr] gap-4 px-6 py-4 text-[13px] text-[#d8c7c3] border-b border-white/5 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-[34px] w-[34px] rounded-full bg-[#2a1c1c] border border-white/10 overflow-hidden">
                            {a.profileImage ? (
                              <img
                                src={a.profileImage}
                                alt={a.name ?? a.email}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <div className="text-[#e6d6d2]">
                              {a.name ?? "(No name)"}
                            </div>
                            <div className="text-[12px] text-[#8d7b77]">{a.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <CheckIcon ok={Boolean(a.isVerified)} />
                        </div>

                        <div className="text-[#e6d6d2]">{formatPrice(a.subscriptionPrice)}</div>

                        <div>
                          {isSuspended ? (
                            <span className="inline-flex items-center rounded-[4px] bg-[#7a4b28]/45 border border-[#c9853b]/25 px-3 py-[3px] text-[12px] text-[#d8b58a]">
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-[4px] bg-[#243225]/45 border border-[#9bd39b]/20 px-3 py-[3px] text-[12px] text-[#bfe6bf]">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end">
                          <Link
                            to={`/admin/artists/${a.id}`}
                            className="text-[13px] text-[#cdbdb8] hover:text-white"
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

          {createOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-[420px] rounded-[10px] border border-white/10 bg-[#141010]/95 backdrop-blur px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
                <div className="text-[16px] tracking-wide text-[#e6d6d2]">Create new artist</div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Name (optional)</div>
                    <input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="Artist name"
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Email</div>
                    <input
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="artist@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Phone</div>
                    <input
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="+1 555 123 4567"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Genre</div>
                    <input
                      value={createGenre}
                      onChange={(e) => setCreateGenre(e.target.value)}
                      className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="Hip-hop, Pop, Classical..."
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Subscription Price</div>
                    <input
                      value={createSubscriptionPrice}
                      onChange={(e) => setCreateSubscriptionPrice(e.target.value)}
                      className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <div className="text-[13px] text-[#b8a6a1]">Temporary password</div>
                    <input
                      type="password"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="mt-2 w-full h-[40px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="Temporary password"
                      autoComplete="new-password"
                    />
                  </div>
                  {createError ? (
                    <div className="text-[13px] text-[#e3a1a1]">{createError}</div>
                  ) : null}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={createBusy}
                      onClick={() => {
                        if (createBusy) return;
                        setCreateOpen(false);
                        setCreateError(null);
                      }}
                      className="h-[36px] px-4 rounded-[6px] border border-white/10 bg-[#0e0a0a]/35 text-[13px] text-[#d8c7c3] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={createBusy}
                      onClick={onCreateArtist}
                      className="h-[36px] px-4 rounded-[6px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[13px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.45)] disabled:opacity-60"
                    >
                      {createBusy ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
