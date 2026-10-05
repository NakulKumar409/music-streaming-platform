import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Lock,
  Music2,
  UploadCloud,
  Video,
} from "lucide-react";
import { http, toApiFailure } from "../services/http";

type UploadResult = {
  id: number;
  title: string;
  type: "AUDIO" | "VIDEO";
  lifecycleState: string;
  technicalStatus: string;
  isApproved: boolean;
};

export default function ArtistContentUploadPage() {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [contentType, setContentType] = useState<"AUDIO" | "VIDEO">("AUDIO");
  const [subscriptionRequired, setSubscriptionRequired] = useState(true);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const mediaAccept = contentType === "AUDIO"
    ? "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac"
    : "video/mp4,video/quicktime";

  const mediaLabel = contentType === "AUDIO" ? "Audio file" : "Video file";

  const canSubmit = useMemo(
    () => Boolean(title.trim() && genre.trim() && thumbnail && media && !submitting),
    [genre, media, submitting, thumbnail, title]
  );

  const resetFiles = () => {
    setThumbnail(null);
    setMedia(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const missing: string[] = [];
    if (!title.trim()) missing.push("title");
    if (!genre.trim()) missing.push("genre");
    if (!thumbnail) missing.push("cover image");
    if (!media) missing.push(mediaLabel.toLowerCase());

    if (missing.length) {
      setError(`Please provide ${missing.join(", ")}.`);
      return;
    }

    const form = new FormData();
    form.append("title", title.trim());
    form.append("genre", genre.trim());
    form.append("contentType", contentType);
    form.append("subscriptionRequired", String(subscriptionRequired));
    form.append("thumbnail", thumbnail!);
    form.append("media", media!);

    try {
      setSubmitting(true);
      const response = await http.post("/api/v1/artist/media/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      });
      const uploaded = response.data?.content as UploadResult | undefined;
      if (!uploaded) throw new Error("Upload completed but no content result was returned");
      setResult(uploaded);
      setTitle("");
      setGenre("");
      resetFiles();
    } catch (e: any) {
      const failure = toApiFailure(e);
      setError(failure.message || e?.message || "Content upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-surface p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-2.5 text-primary">
            <UploadCloud size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Upload Content</h1>
            <p className="mt-1 text-sm text-[#B8A6A1]">
              Upload your own release. No admin song approval is required. Content becomes live automatically when media processing is ready.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Upload accepted successfully.</div>
            <div className="mt-1 text-emerald-200/80">
              “{result.title}” is {result.technicalStatus === "READY" ? "live now" : "processing and will go live automatically when ready"}.
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-surface p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-white/70">Content type</span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["AUDIO", "VIDEO"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setContentType(kind);
                      setMedia(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      contentType === kind
                        ? "border-primary/40 bg-primary/10 text-white"
                        : "border-white/10 bg-black/20 text-white/50 hover:text-white"
                    }`}
                  >
                    {kind === "AUDIO" ? <Music2 size={17} /> : <Video size={17} />}
                    {kind === "AUDIO" ? "Audio" : "Video"}
                  </button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white/70">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                disabled={submitting}
                placeholder="Release title"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-primary/50"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white/70">Genre</span>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                maxLength={80}
                disabled={submitting}
                placeholder="e.g. Indie Pop"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-primary/50"
              />
            </label>

            <label className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex gap-3">
                <Lock size={18} className="mt-0.5 text-primary" />
                <div>
                  <div className="text-sm font-medium text-white">Subscriber-only playback</div>
                  <div className="mt-1 text-xs text-white/45">
                    Require an active subscription before fans can play this release.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={subscriptionRequired}
                onChange={(e) => setSubscriptionRequired(e.target.checked)}
                disabled={submitting}
                className="mt-1 h-4 w-4 accent-current"
              />
            </label>
          </div>

          <div className="space-y-5">
            <label className="block rounded-2xl border border-dashed border-white/15 bg-black/20 p-5">
              <span className="flex items-center gap-2 text-sm font-medium text-white/70">
                <ImageIcon size={17} /> Cover image
              </span>
              <div className="mt-2 text-xs text-white/40">JPEG, PNG or WebP</div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={submitting}
                onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                className="mt-4 block w-full text-sm text-white/60"
              />
              {thumbnail && <div className="mt-2 truncate text-xs text-primary">{thumbnail.name}</div>}
            </label>

            <label className="block rounded-2xl border border-dashed border-white/15 bg-black/20 p-5">
              <span className="flex items-center gap-2 text-sm font-medium text-white/70">
                {contentType === "AUDIO" ? <FileAudio size={17} /> : <FileVideo size={17} />}
                {mediaLabel}
              </span>
              <div className="mt-2 text-xs text-white/40">
                {contentType === "AUDIO" ? "MP3, M4A, WAV or AAC" : "MP4 or MOV"}
              </div>
              <input
                key={contentType}
                type="file"
                accept={mediaAccept}
                disabled={submitting}
                onChange={(e) => setMedia(e.target.files?.[0] || null)}
                className="mt-4 block w-full text-sm text-white/60"
              />
              {media && <div className="mt-2 truncate text-xs text-primary">{media.name}</div>}
            </label>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/45">
              Files are validated by MIME type, size and file signature before provider upload. Failed or still-processing media is not exposed to fans.
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
            {submitting ? "Uploading…" : "Upload & Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}
