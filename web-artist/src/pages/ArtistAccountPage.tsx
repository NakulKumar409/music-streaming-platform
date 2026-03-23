import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../services/http";

type MeResponse = {
  success: boolean;
  artist?: {
    id: number;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
    bannerImageUrl: string | null;
    bio: string;
    accentColor: string | null;
    artistStatus?: string;
    socialLinks?: Record<string, any> | null;
  };
};

const ACCENTS = ["#6b4bb8", "#5b6bb8", "#4b87b8", "#5bb88b", "#b8b25b", "#b8744b", "#b85b5b", "#d48a3c"];

export default function ArtistAccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState<"profile" | "banner" | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const [artistStatus, setArtistStatus] = useState<string>("PENDING");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);

  const [spotify, setSpotify] = useState("");
  const [youtube, setYoutube] = useState("");
  const [instagram, setInstagram] = useState("");

  const [profileLocalPreview, setProfileLocalPreview] = useState<string | null>(null);
  const [bannerLocalPreview, setBannerLocalPreview] = useState<string | null>(null);

  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const apiBaseUrl = useMemo(() => {
    return (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").toString().replace(/\/$/, "");
  }, []);

  const resolvePublicUrl = (url: string | null) => {
    const raw = (url || "").toString().trim();
    if (!raw) return null;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return `${apiBaseUrl}${raw}`;
    return raw;
  };

  const profileSrc = useMemo(() => {
    return profileLocalPreview || resolvePublicUrl(profileImageUrl);
  }, [profileImageUrl, profileLocalPreview]);
  const bannerSrc = useMemo(() => {
    return bannerLocalPreview || resolvePublicUrl(bannerImageUrl);
  }, [bannerImageUrl, bannerLocalPreview]);

  useEffect(() => {
    return () => {
      if (profileLocalPreview) URL.revokeObjectURL(profileLocalPreview);
      if (bannerLocalPreview) URL.revokeObjectURL(bannerLocalPreview);
    };
  }, [bannerLocalPreview, profileLocalPreview]);

  const uploadImage = async (kind: "profile" | "banner", file: File) => {
    setImageError(null);
    setImageUploading(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("image", file);

      const res = await http.post<{ success: boolean; url?: string }>(
        "/api/v1/artist/uploads/image",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const url = resolvePublicUrl((res.data as any)?.url ?? null);
      if (!url) {
        setImageError("Upload failed. Please try again.");
        return;
      }

      if (kind === "profile") setProfileImageUrl(url);
      if (kind === "banner") setBannerImageUrl(url);
    } catch (err: any) {
      const message =
        (err?.response?.data?.message as string | undefined) ||
        (err?.message as string | undefined) ||
        "Upload failed. Please try again.";
      setImageError(message);
    } finally {
      setImageUploading(null);
    }
  };

  const onPickImage = async (kind: "profile" | "banner", file: File) => {
    const objectUrl = URL.createObjectURL(file);
    if (kind === "profile") {
      if (profileLocalPreview) URL.revokeObjectURL(profileLocalPreview);
      setProfileLocalPreview(objectUrl);
    }
    if (kind === "banner") {
      if (bannerLocalPreview) URL.revokeObjectURL(bannerLocalPreview);
      setBannerLocalPreview(objectUrl);
    }

    await uploadImage(kind, file);

    if (kind === "profile") {
      setProfileLocalPreview(null);
    }
    if (kind === "banner") {
      setBannerLocalPreview(null);
    }
  };

  const onPasteImage = async (kind: "profile" | "banner", e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;

    const imgItem = Array.from(items).find((it) => it.type.startsWith("image/"));
    if (!imgItem) return;

    const blob = imgItem.getAsFile();
    if (!blob) return;

    e.preventDefault();

    const ext = blob.type.split("/")[1] || "png";
    const file = new File([blob], `${kind}-${Date.now()}.${ext}`, { type: blob.type });
    await uploadImage(kind, file);
  };

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.12) 0%, rgba(25,18,18,0.55) 45%, rgba(10,8,8,0.92) 100%)"
    } as const;
  }, []);

  const load = async () => {
    const res = await http.get<MeResponse>("/api/v1/artist/me");
    const a = res.data?.artist;
    if (!a) return;
    setRegisteredEmail((a.email ?? "").toString());
    setArtistStatus((a.artistStatus ?? "PENDING").toString());
    setName(a.name ?? "");
    setBio(a.bio ?? "");
    setProfileImageUrl(resolvePublicUrl(a.profileImageUrl ?? null));
    setBannerImageUrl(resolvePublicUrl(a.bannerImageUrl ?? null));
    setAccentColor(a.accentColor ?? null);

    const socials = (a.socialLinks ?? null) as any;
    setSpotify((socials?.spotify ?? "").toString());
    setYoutube((socials?.youtube ?? "").toString());
    setInstagram((socials?.instagram ?? "").toString());
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await load();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const socialLinks = {
      spotify: spotify.trim(),
      youtube: youtube.trim(),
      instagram: instagram.trim()
    };

    if (!socialLinks.spotify || !socialLinks.youtube || !socialLinks.instagram) {
      setSaveError("Spotify, YouTube, and Instagram links are required");
      setSaving(false);
      return;
    }

    try {
      await http.patch("/api/v1/artist/me", {
        name,
        bio,
        profileImageUrl,
        bannerImageUrl,
        accentColor,
        socialLinks
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const saveAccent = async (next: string) => {
    setAccentColor(next);
    try {
      await http.patch("/api/v1/artist/me", { accentColor: next });
    } catch {
      // ignore; user can retry with Save Changes
    }
  };

  const openPassword = () => {
    setPasswordError(null);
    setPasswordSaved(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordOpen(true);
  };

  const submitPassword = async () => {
    setPasswordError(null);
    setPasswordSaved(false);
    const cp = currentPassword;
    const np = newPassword;
    const conf = confirmPassword;

    if (!cp || !np) {
      setPasswordError("Current password and new password are required");
      return;
    }
    if (np.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (np !== conf) {
      setPasswordError("New password and confirmation do not match");
      return;
    }

    setPasswordBusy(true);
    try {
      await http.patch("/api/v1/artist/update-password", {
        currentPassword: cp,
        newPassword: np
      });
      setPasswordSaved(true);
      window.setTimeout(() => {
        setPasswordOpen(false);
      }, 900);
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || err?.message || "Failed to update password");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-white/10 bg-[#141010]/30 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      style={backgroundStyle}
    >
      <div className="absolute inset-0 opacity-60" />

      <div className="relative px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="text-[28px] font-light tracking-wide text-[#e6d6d2]">Artist Profile Center</div>
        <div className="mt-2 text-[13px] text-[#b8a6a1]">Manage your public profile, socials, and account security.</div>

        <div className="mt-8 rounded-[10px] border border-white/10 bg-[#0e0a0a]/35 overflow-hidden">
          <div className="relative h-[220px] bg-[#0a0808]">
            {bannerSrc ? (
              <img src={bannerSrc} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-[#241a1a] to-[#0a0808]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/60" />

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = e.target.files?.[0];
                if (!file) return;
                await onPickImage("banner", file);
                if (input) input.value = "";
              }}
            />
          </div>

          <div className="px-4 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  className="relative h-[96px] w-[96px] rounded-full overflow-hidden border border-white/10 bg-[#141010] shadow-[0_14px_30px_rgba(0,0,0,0.55)]"
                  aria-label="Change profile image"
                >
                  {profileSrc ? (
                    <img src={profileSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="h-[34px] w-[34px] rounded-full border border-white/15 bg-[#0a0808]/55 backdrop-blur flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M4 7H7L9 4H15L17 7H20C21.1046 7 22 7.89543 22 9V19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V9C2 7.89543 2.89543 7 4 7Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M12 17C14.2091 17 16 15.2091 16 13C16 10.7909 14.2091 9 12 9C9.79086 9 8 10.7909 8 13C8 15.2091 9.79086 17 12 17Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await onPickImage("profile", file);
                    if (input) input.value = "";
                  }}
                />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-[26px] font-light tracking-wide text-[#e6d6d2]">{name || "—"}</div>
                  <div
                    className={`inline-flex items-center rounded-full border px-3 py-[6px] text-[11px] uppercase tracking-widest ${
                      artistStatus.toUpperCase() === "APPROVED"
                        ? "border-[#3b5d45]/40 bg-[#0f1d14]/55 text-[#9ad0a7]"
                        : "border-[#7a4b28]/45 bg-[#2a1a17]/55 text-[#e0c7c0]"
                    }`}
                  >
                    {artistStatus.toUpperCase() === "APPROVED" ? "Verified" : "Pending"}
                  </div>

                  <div className="ml-auto text-[12px] text-[#8d7b77]">
                    {imageUploading ? "Uploading image..." : loading ? "Loading..." : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="mt-3 inline-flex items-center h-[34px] rounded-[8px] border border-white/10 bg-[#141010]/35 px-4 text-[13px] text-[#d8c7c3] hover:text-white hover:bg-white/5"
                >
                  Change banner
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
            <div className="text-[14px] tracking-wide text-[#e6d6d2]">Basic Info</div>
            <div className="mt-1 text-[12px] text-[#8d7b77]">Your public artist profile.</div>

            {imageError ? (
              <div className="mt-4 rounded-[8px] border border-white/10 bg-[#0e0a0a]/35 px-4 py-3 text-[13px] text-[#d7b2ab]">
                {imageError}
              </div>
            ) : null}
            {saveError ? (
              <div className="mt-4 rounded-[8px] border border-[#e3a1a1]/25 bg-[#7a4b28]/30 px-4 py-3 text-[13px] text-[#e3a1a1]">
                {saveError}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-4">
              <div>
                <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Registered Email</div>
                <div className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/20 border border-white/10 px-4 flex items-center text-[14px] text-[#b8a6a1]">
                  {registeredEmail || "—"}
                </div>
              </div>

              <div>
                <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Display name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="Luna Ray"
                />
              </div>

              <div>
                <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Bio</div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 py-3 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="Describe your music..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Profile Image URL</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-[44px] w-[44px] rounded-full overflow-hidden border border-white/10 bg-[#141010]">
                      {profileSrc ? (
                        <img src={profileSrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-b from-[#2a1a17] to-[#0e0a0a]" />
                      )}
                    </div>
                    <input
                      value={profileImageUrl ?? ""}
                      onChange={(e) => setProfileImageUrl(e.target.value || null)}
                      className="flex-1 h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="https://..."
                    />
                  </div>

                  <div
                    className="mt-2 rounded-[8px] border border-white/10 bg-[#0e0a0a]/35 px-4 py-3"
                    tabIndex={0}
                    onPaste={(e) => onPasteImage("profile", e)}
                    title="Paste an image here"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => profileInputRef.current?.click()}
                        className="h-[32px] px-3 rounded-[6px] border border-white/10 bg-[#141010] text-[12px] text-[#e6d6d2]"
                      >
                        Choose file
                      </button>
                      <div className="text-[11px] text-[#8d7b77]">
                        {imageUploading === "profile" ? "Uploading..." : "Select or paste"}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Banner Image URL</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-[44px] w-[68px] rounded-[8px] overflow-hidden border border-white/10 bg-[#141010]">
                      {bannerSrc ? (
                        <img src={bannerSrc} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-b from-[#241a1a] to-[#0a0808]" />
                      )}
                    </div>
                    <input
                      value={bannerImageUrl ?? ""}
                      onChange={(e) => setBannerImageUrl(e.target.value || null)}
                      className="flex-1 h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                      placeholder="https://..."
                    />
                  </div>

                  <div
                    className="mt-2 rounded-[8px] border border-white/10 bg-[#0e0a0a]/35 px-4 py-3"
                    tabIndex={0}
                    onPaste={(e) => onPasteImage("banner", e)}
                    title="Paste an image here"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="h-[32px] px-3 rounded-[6px] border border-white/10 bg-[#141010] text-[12px] text-[#e6d6d2]"
                      >
                        Choose file
                      </button>
                      <div className="text-[11px] text-[#8d7b77]">
                        {imageUploading === "banner" ? "Uploading..." : "Select or paste"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
              <div className="text-[14px] tracking-wide text-[#e6d6d2]">Social Connections</div>
              <div className="mt-1 text-[12px] text-[#8d7b77]">These links are required and shown to fans.</div>

              <div className="mt-5 grid grid-cols-1 gap-4">
                <div>
                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Spotify</div>
                  <input
                    value={spotify}
                    onChange={(e) => setSpotify(e.target.value)}
                    className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                    placeholder="https://open.spotify.com/artist/..."
                  />
                </div>

                <div>
                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">YouTube</div>
                  <input
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                    placeholder="https://youtube.com/@..."
                  />
                </div>

                <div>
                  <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Instagram</div>
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                    placeholder="https://instagram.com/..."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
              <div className="text-[14px] tracking-wide text-[#e6d6d2]">Accent Color</div>
              <div className="mt-1 text-[12px] text-[#8d7b77]">Choose your theme highlight.</div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                {ACCENTS.map((c) => {
                  const active = (accentColor || "").toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => saveAccent(c)}
                      className={`h-[18px] w-[18px] rounded-full border ${active ? "border-white/70" : "border-white/15"}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set accent ${c}`}
                    />
                  );
                })}
              </div>

              <div className="mt-5 flex items-center gap-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={save}
                  className="h-[46px] px-8 rounded-[7px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[15px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.35)] disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <div className="text-[13px] text-[#6e8f72]">{saved ? "✓ Saved changes" : ""}</div>
              </div>
            </div>

            <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/35 px-5 py-5">
              <div className="text-[14px] tracking-wide text-[#e6d6d2]">Danger Zone</div>
              <div className="mt-1 text-[12px] text-[#8d7b77]">Security actions for your account.</div>

              <div className="mt-4 rounded-[10px] border border-white/10 bg-[#0a0808]/35 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13px] text-[#e6d6d2]">Change Password</div>
                    <div className="mt-1 text-[12px] text-[#8d7b77]">Update your login password.</div>
                  </div>

                  <button
                    type="button"
                    onClick={openPassword}
                    className="h-[36px] px-4 rounded-[8px] border border-white/10 bg-[#141010]/35 text-[13px] text-[#d8c7c3] hover:text-white hover:bg-white/5"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {passwordOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              if (passwordBusy) return;
              setPasswordOpen(false);
            }}
          />
          <div className="relative w-full max-w-[520px] rounded-[12px] border border-white/10 bg-[#141010]/80 backdrop-blur shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <div className="px-6 py-5 border-b border-white/10">
              <div className="text-[16px] tracking-wide text-[#e6d6d2]">Change Password</div>
              <div className="mt-1 text-[12px] text-[#8d7b77]">Enter your current password to confirm.</div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {passwordError ? (
                <div className="rounded-[8px] border border-[#e3a1a1]/25 bg-[#7a4b28]/30 px-4 py-3 text-[13px] text-[#e3a1a1]">
                  {passwordError}
                </div>
              ) : null}
              {passwordSaved ? (
                <div className="rounded-[8px] border border-[#3b5d45]/35 bg-[#0f1d14]/55 px-4 py-3 text-[13px] text-[#9ad0a7]">
                  Password updated.
                </div>
              ) : null}

              <div>
                <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Current Password</div>
                <input
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  type="password"
                  className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="••••••"
                />
              </div>

              <div>
                <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">New Password</div>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <div className="text-[12px] uppercase tracking-widest text-[#8d7b77]">Confirm New Password</div>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  className="mt-2 w-full h-[46px] rounded-[6px] bg-[#0e0a0a]/35 border border-white/10 px-4 text-[14px] text-[#e6d6d2] outline-none focus:border-white/20"
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            <div className="px-6 py-5 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={passwordBusy}
                onClick={() => setPasswordOpen(false)}
                className="h-[38px] px-4 rounded-[8px] border border-white/10 bg-[#1a1414]/40 text-[13px] text-[#d8c7c3] hover:text-white hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={passwordBusy}
                onClick={submitPassword}
                className="h-[38px] px-5 rounded-[8px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] text-[13px] font-light tracking-wide text-[#e6d6d2] disabled:opacity-60"
              >
                {passwordBusy ? "Saving..." : "Update password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
