import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../services/http";

type PendingItem = {
  id: number;
  name: string | null;
  email: string;
  submittedAt: string | null;
  artistStatus?: string;
  artistBio: string;
  portfolioLinks: string[];
  appealMessage?: string | null;
  appealed?: boolean;
  adminNote?: string | null;
};

type PendingArtistsResponse = {
  success: boolean;
  items?: PendingItem[];
  message?: string;
};

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

export default function AdminArtistApplicationsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const [active, setActive] = useState<PendingItem | null>(null);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.16) 0%, rgba(75,25,39,0.88) 55%, rgba(10,8,8,0.97) 100%)"
    } as const;
  }, []);

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await http.get<PendingArtistsResponse>("/api/v1/admin/pending-artists");
      const next = Array.isArray(res.data?.items) ? (res.data.items as PendingItem[]) : [];
      setItems(next);
      setActive(next[0] ?? null);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin/login", { replace: true });
        return;
      }
      setApiError(e?.response?.data?.message || e?.message || "Failed to load pending applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = async (action: "APPROVE" | "REJECT") => {
    if (!active) return;

    if (action === "REJECT" && !rejectReason.trim()) {
      setApiError("Rejection reason is required.");
      return;
    }

    setResolveBusy(true);
    setApiError(null);

    try {
      const res = await http.patch(`/api/v1/admin/resolve-artist/${active.id}`, {
        action,
        reason: action === "REJECT" ? rejectReason.trim() : undefined
      });

      if (!res.data?.success) {
        setApiError(res.data?.message || "Failed to resolve application");
        return;
      }

      const next = items.filter((x) => x.id !== active.id);
      setItems(next);
      setActive(next[0] ?? null);
      setRejectReason("");
    } catch (e: any) {
      setApiError(e?.response?.data?.message || e?.message || "Failed to resolve application");
    } finally {
      setResolveBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0808] text-white" style={backgroundStyle}>
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-6 sm:py-8">
        <div className="mt-10 flex items-end justify-between">
          <div>
            <div className="text-[38px] leading-[46px] font-light tracking-wide text-[#e6d6d2]">
              Artist Applications
            </div>
            <div className="mt-2 text-[13px] text-[#b8a6a1]">Review, approve, or reject pending artist applications.</div>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-[36px] px-4 rounded-[6px] border border-white/10 bg-[#141010]/35 text-[13px] text-[#d8c7c3] disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {apiError ? (
          <div className="mt-4 rounded-[6px] border border-[#e3a1a1]/25 bg-[#7a4b28]/30 px-4 py-3 text-[13px] text-[#e3a1a1]">
            Error: {apiError}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_20px_50px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 text-[13px] text-[#a99792]">
              Pending ({items.length})
            </div>

            {loading ? (
              <div className="px-5 py-6 text-[13px] text-[#a99792]">Loading...</div>
            ) : items.length ? (
              <div className="max-h-[560px] overflow-auto">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setActive(it);
                      setRejectReason("");
                      setApiError(null);
                    }}
                    className={`w-full text-left px-5 py-4 border-b border-white/5 hover:bg-white/5 ${active?.id === it.id ? "bg-white/5" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-[13px] text-[#e6d6d2] truncate">{it.name ?? it.email}</div>
                      {it.appealed ? (
                        <span className="shrink-0 inline-flex items-center rounded-[999px] bg-[#2d2230]/70 border border-[#c9853b]/25 px-2.5 py-[2px] text-[11px] text-[#d8b58a]">
                          Appealed
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12px] text-[#8d7b77] truncate">{it.email}</div>
                    <div className="mt-2 text-[11px] text-[#6e5c59]">Submitted: {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : "-"}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-[13px] text-[#a99792]">No pending applications.</div>
            )}
          </div>

          <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_20px_50px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="text-[13px] text-[#a99792]">Application details</div>
              <div className="text-[12px] text-[#6e5c59]">{active ? `ID: ${active.id}` : ""}</div>
            </div>

            {!active ? (
              <div className="px-6 py-10 text-[13px] text-[#a99792]">Select an application to review.</div>
            ) : (
              <div className="px-6 py-6 space-y-6">
                <div>
                  <div className="text-[12px] tracking-wide text-[#b8a6a1]">Name</div>
                  <div className="mt-2 text-[14px] text-[#e6d6d2]">{active.name ?? "(No name)"}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] tracking-wide text-[#b8a6a1]">Status</div>
                    <div className="mt-2 text-[13px] text-[#cdbdb8]">
                      {(active.artistStatus ?? "PENDING").toString().toUpperCase()}
                    </div>
                  </div>
                  {active.appealed ? (
                    <span className="inline-flex items-center rounded-[999px] bg-[#2d2230]/70 border border-[#c9853b]/25 px-3 py-[3px] text-[12px] text-[#d8b58a]">
                      Appealed
                    </span>
                  ) : null}
                </div>

                <div>
                  <div className="text-[12px] tracking-wide text-[#b8a6a1]">Email</div>
                  <div className="mt-2 text-[14px] text-[#e6d6d2]">{active.email}</div>
                </div>

                <div>
                  <div className="text-[12px] tracking-wide text-[#b8a6a1]">Bio</div>
                  <div className="mt-2 text-[13px] text-[#cdbdb8] leading-6 whitespace-pre-wrap">{active.artistBio || "-"}</div>
                </div>

                {active.appealMessage ? (
                  <div className="rounded-[8px] border border-white/10 bg-black/20 px-5 py-4">
                    <div className="text-[12px] tracking-wide text-[#b8a6a1]">Appeal message</div>
                    <div className="mt-2 text-[13px] text-[#e6d6d2] leading-6 whitespace-pre-wrap">{active.appealMessage}</div>
                  </div>
                ) : null}

                <div>
                  <div className="text-[12px] tracking-wide text-[#b8a6a1]">Portfolio</div>
                  {active.portfolioLinks?.length ? (
                    <div className="mt-2 space-y-2">
                      {active.portfolioLinks.map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[13px] text-[#cdbdb8] hover:text-white truncate"
                        >
                          {u}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[13px] text-[#8d7b77]">-</div>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="text-[12px] tracking-wide text-[#b8a6a1]">Reject reason (required if rejecting)</div>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-2 w-full min-h-[90px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[13px] text-[#e6d6d2] outline-none focus:border-white/20"
                    placeholder="Explain why this application is rejected..."
                  />

                  <div className="mt-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={resolveBusy}
                      onClick={() => resolve("REJECT")}
                      className="h-[38px] px-4 rounded-[7px] border border-[#e3a1a1]/25 bg-[#2a1010]/35 text-[13px] text-[#e3a1a1] disabled:opacity-60"
                    >
                      {resolveBusy ? "Working..." : "Reject"}
                    </button>

                    <button
                      type="button"
                      disabled={resolveBusy}
                      onClick={() => resolve("APPROVE")}
                      className="h-[38px] px-5 rounded-[7px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[13px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
                    >
                      {resolveBusy ? "Working..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
