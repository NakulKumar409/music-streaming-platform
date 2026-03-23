import { useEffect, useMemo, useState } from "react";
import { http } from "../services/http";

type ChannelPreviewResponse = {
  success: boolean;
  artist?: {
    id: number;
    name: string | null;
    email: string;
    profileImageUrl: string | null;
    bannerImageUrl: string | null;
    bio: string;
  };
  items?: Array<{
    id: number;
    title: string;
    type: string;
    thumbnailUrl: string | null;
    subscriptionRequired: boolean;
    publishedAt: string | null;
    isEarlyAccess: boolean;
  }>;
};

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 11V8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6 11H18C19.1046 11 20 11.8954 20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13C4 11.8954 4.89543 11 6 11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ArtistChannelPreviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChannelPreviewResponse | null>(null);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 35% 15%, rgba(193,117,86,0.14) 0%, rgba(25,18,18,0.58) 48%, rgba(10,8,8,0.92) 100%)"
    } as const;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await http.get<ChannelPreviewResponse>("/api/v1/artist/channel-preview");
        if (!mounted) return;
        setData(res.data ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load channel preview");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const artist = data?.artist;
  const items = Array.isArray(data?.items) ? data!.items! : [];

  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      style={backgroundStyle}
    >
      <div className="relative px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="text-[28px] font-light tracking-wide text-[#e6d6d2]">Channel Preview Summary</div>

        {error ? <div className="mt-4 text-[13px] text-[#e3a1a1]">{error}</div> : null}

        <div className="mt-6 rounded-[10px] border border-white/10 bg-[#0e0a0a]/22 overflow-hidden">
          <div className="relative h-[220px]">
            {artist?.bannerImageUrl ? (
              <img src={artist.bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-[#3a1b19] to-[#0e0a0a]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0808]/90 via-[#0b0808]/35 to-transparent" />

            <div className="absolute left-4 bottom-5 right-4 sm:left-8 sm:bottom-6 sm:right-8 flex items-end gap-5">
              <div className="h-[86px] w-[86px] rounded-[16px] overflow-hidden border border-white/15 bg-[#141010]/70 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                {artist?.profileImageUrl ? (
                  <img src={artist.profileImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[26px] font-light tracking-wide text-[#e6d6d2] truncate">
                  {loading ? "—" : artist?.name || artist?.email || "Artist"}
                </div>
                <div className="mt-2 text-[13px] text-[#cbbab4] max-w-[820px] line-clamp-2">
                  {loading ? "" : artist?.bio || ""}
                </div>
                <div className="mt-3 text-[12px] text-[#8d7b77]">Preview only — actual fan view may vary</div>
              </div>
            </div>
          </div>

          <div className="px-4 py-6 sm:px-8 sm:py-7">
            {loading ? (
              <div className="text-[13px] text-[#b8a6a1]">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-[13px] text-[#b8a6a1]">No published content yet.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex items-center gap-4">
                    <div className="h-[46px] w-[46px] rounded-[12px] overflow-hidden border border-white/10 bg-[#141010]/70">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-[#e6d6d2] truncate">
                        {item.title}
                        <span className="text-[#8d7b77]">{item.type ? ` (${item.type.toLowerCase()})` : ""}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.isEarlyAccess ? (
                        <div className="h-[30px] px-3 rounded-[8px] border border-[#7a3f31]/30 bg-[#1a1110]/55 text-[12px] text-[#e6d6d2] flex items-center gap-2">
                          <span className="text-[#c97a54]">
                            <LockIcon />
                          </span>
                          Early Access
                        </div>
                      ) : item.subscriptionRequired ? (
                        <div className="h-[30px] px-3 rounded-[8px] border border-white/10 bg-[#141010]/55 text-[12px] text-[#cdbdb8] flex items-center gap-2">
                          <span className="text-[#c97a54]">
                            <LockIcon />
                          </span>
                          Subscribers
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
