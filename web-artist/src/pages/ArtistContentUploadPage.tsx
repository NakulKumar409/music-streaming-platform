import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../services/http";

type UploadResponse = {
  success: boolean;
  item?: {
    id: number;
  };
  message?: string;
  correlationId?: string;
};

type UploadFormState = {
  title: string;
  genre: string;
  thumbnailFile: File | null;
  audioFile: File | null;
  videoFile: File | null;
};

const GENRES = [
  "Pop",
  "Hip-Hop",
  "Rock",
  "R&B",
  "Electronic",
  "Jazz",
  "Classical",
  "Country",
  "Indie",
  "Other"
];

function buildObjectUrl(file: File | null) {
  if (!file) return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function UnifiedUploadSection({
  value,
  onChange,
  onPost,
  onError,
  busy
}: {
  value: UploadFormState;
  onChange: (next: UploadFormState) => void;
  onPost: () => void;
  onError: (message: string | null) => void;
  busy: boolean;
}) {
  const thumbnailPreviewUrl = useMemo(() => buildObjectUrl(value.thumbnailFile), [value.thumbnailFile]);
  const audioPreviewUrl = useMemo(() => buildObjectUrl(value.audioFile), [value.audioFile]);
  const videoPreviewUrl = useMemo(() => buildObjectUrl(value.videoFile), [value.videoFile]);

  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [thumbnailPreviewUrl, audioPreviewUrl, videoPreviewUrl]);

  const validateAudioFile = (file: File) => {
    const name = (file?.name || "").toLowerCase();
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    return ext === ".mp3";
  };

  const validateVideoFile = (file: File) => {
    const name = (file?.name || "").toLowerCase();
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    return ext === ".mp4";
  };

  const setAudioFile = (file: File | null) => {
    onError(null);
    if (!file) {
      onChange({ ...value, audioFile: null });
      return;
    }
    if (!validateAudioFile(file)) {
      onError("Invalid audio file type. Please select a .mp3 file.");
      if (audioInputRef.current) audioInputRef.current.value = "";
      return;
    }
    onChange({ ...value, audioFile: file });
  };

  const setVideoFile = (file: File | null) => {
    onError(null);
    if (!file) {
      onChange({ ...value, videoFile: null });
      return;
    }
    if (!validateVideoFile(file)) {
      onError("Invalid video file type. Please select a .mp4 file.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    onChange({ ...value, videoFile: file });
  };

  const setThumbnailFile = (file: File | null) => {
    onError(null);
    onChange({ ...value, thumbnailFile: file });
  };

  const onPasteZone = (e: React.ClipboardEvent<HTMLDivElement>, kind: "THUMBNAIL" | "AUDIO" | "VIDEO") => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!files.length) return;
    e.preventDefault();

    const f = files[0];
    if (kind === "THUMBNAIL") {
      if (!f.type.startsWith("image/")) {
        onError("Pasted file is not an image.");
        return;
      }
      setThumbnailFile(f);
      return;
    }

    if (kind === "AUDIO") {
      setAudioFile(f);
      return;
    }

    setVideoFile(f);
  };

  const onDropZone = (e: React.DragEvent<HTMLDivElement>, kind: "THUMBNAIL" | "AUDIO" | "VIDEO") => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    const f = files[0];

    if (kind === "THUMBNAIL") {
      if (!f.type.startsWith("image/")) {
        onError("Dropped file is not an image.");
        return;
      }
      setThumbnailFile(f);
      return;
    }

    if (kind === "AUDIO") {
      setAudioFile(f);
      return;
    }

    setVideoFile(f);
  };

  const canPost = Boolean(
    (value.title || "").trim() &&
      (value.genre || "").trim() &&
      value.thumbnailFile &&
      value.audioFile &&
      value.videoFile
  );

  return (
    <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/22 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-[15px] tracking-wide text-[#e6d6d2]">Upload Content</div>
          <div className="mt-1 text-[12px] text-[#b8a6a1]">
            Fill out details, preview locally, then post.
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] uppercase tracking-widest text-[#b8a6a1]">Title</label>
            <input
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              className="mt-2 w-full h-[42px] rounded-[8px] border border-white/10 bg-[#141010]/55 px-3 text-[13px] text-[#f0e5e2] outline-none focus:border-white/20"
              placeholder="Track title"
            />
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-widest text-[#b8a6a1]">Genre</label>
            <select
              value={value.genre}
              onChange={(e) => onChange({ ...value, genre: e.target.value })}
              className="mt-2 w-full h-[42px] rounded-[8px] border border-white/10 bg-[#141010]/55 px-3 text-[13px] text-[#f0e5e2] outline-none focus:border-white/20"
            >
              <option value="" disabled>
                Select genre
              </option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-widest text-[#b8a6a1]">Thumbnail (Image)</label>
            <div
              tabIndex={0}
              onPaste={(e) => onPasteZone(e, "THUMBNAIL")}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => onDropZone(e, "THUMBNAIL")}
              className="mt-2 rounded-[10px] border border-white/10 bg-[#141010]/35 p-3"
            >
              <div className="flex items-center gap-3">
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setThumbnailFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="h-[32px] rounded-[6px] border border-white/10 bg-[#141010]/60 px-3 text-[12px] font-light tracking-wide text-[#e6d6d2] hover:bg-white/5"
                >
                  Choose file
                </button>
                <div className="min-w-0 text-[12px] text-[#d8c7c3] truncate">
                  {value.thumbnailFile?.name || "No file chosen"}
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#8d7b77]">
                Drag & drop an image here, or paste an image from clipboard.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-widest text-[#b8a6a1]">Audio File (MP3)</label>
            <div
              tabIndex={0}
              onPaste={(e) => onPasteZone(e, "AUDIO")}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => onDropZone(e, "AUDIO")}
              className="mt-2 rounded-[10px] border border-white/10 bg-[#141010]/35 p-3"
            >
              <div className="flex items-center gap-3">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setAudioFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="h-[32px] rounded-[6px] border border-white/10 bg-[#141010]/60 px-3 text-[12px] font-light tracking-wide text-[#e6d6d2] hover:bg-white/5"
                >
                  Choose file
                </button>
                <div className="min-w-0 text-[12px] text-[#d8c7c3] truncate">{value.audioFile?.name || "No file chosen"}</div>
              </div>
              <div className="mt-2 text-[11px] text-[#8d7b77]">Drag & drop an audio file here, or paste a file from clipboard.</div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-widest text-[#b8a6a1]">Video File (MP4)</label>
            <div
              tabIndex={0}
              onPaste={(e) => onPasteZone(e, "VIDEO")}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => onDropZone(e, "VIDEO")}
              className="mt-2 rounded-[10px] border border-white/10 bg-[#141010]/35 p-3"
            >
              <div className="flex items-center gap-3">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept=".mp4"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setVideoFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="h-[32px] rounded-[6px] border border-white/10 bg-[#141010]/60 px-3 text-[12px] font-light tracking-wide text-[#e6d6d2] hover:bg-white/5"
                >
                  Choose file
                </button>
                <div className="min-w-0 text-[12px] text-[#d8c7c3] truncate">{value.videoFile?.name || "No file chosen"}</div>
              </div>
              <div className="mt-2 text-[11px] text-[#8d7b77]">Drag & drop a video file here, or paste a file from clipboard.</div>
            </div>
          </div>

          <button
            type="button"
            disabled={busy || !canPost}
            onClick={onPost}
            className="mt-2 h-[40px] rounded-[8px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] px-4 text-[13px] font-light tracking-wide text-[#e6d6d2] shadow-[0_10px_25px_rgba(0,0,0,0.25)] disabled:opacity-60"
          >
            {busy ? "Posting..." : "Post Content"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 p-4">
            <div className="text-[12px] uppercase tracking-widest text-[#b8a6a1]">Real-time preview</div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 text-[12px] text-[#cdbdb8]">Thumbnail</div>
                <div className="h-[180px] bg-[#0a0808] flex items-center justify-center">
                  {thumbnailPreviewUrl ? (
                    <img src={thumbnailPreviewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-[12px] text-[#8d7b77]">Select an image to preview</div>
                  )}
                </div>
              </div>

              <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 text-[12px] text-[#cdbdb8]">Audio</div>
                <div className="p-3">
                  {audioPreviewUrl ? (
                    <audio controls className="w-full" src={audioPreviewUrl} />
                  ) : (
                    <div className="text-[12px] text-[#8d7b77]">Select an audio file to preview</div>
                  )}
                </div>
              </div>

              <div className="rounded-[10px] border border-white/10 bg-[#0e0a0a]/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 text-[12px] text-[#cdbdb8]">Video</div>
                <div className="p-3">
                  {videoPreviewUrl ? (
                    <video controls className="w-full rounded-[8px]" src={videoPreviewUrl} />
                  ) : (
                    <div className="text-[12px] text-[#8d7b77]">Select a video file to preview</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[12px] text-[#b8a6a1]">
              Preview happens locally on your device.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArtistContentUploadPage() {
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<UploadFormState>({
    title: "",
    genre: "",
    thumbnailFile: null,
    audioFile: null,
    videoFile: null
  });

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(193,117,86,0.10) 0%, rgba(25,18,18,0.55) 45%, rgba(10,8,8,0.92) 100%)"
    } as const;
  }, []);

  const post = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      const title = (form.title || "").trim();
      const genre = (form.genre || "").trim();

      if (!title) throw new Error("Title is required");
      if (!genre) throw new Error("Genre is required");
      if (!form.thumbnailFile) throw new Error("Thumbnail is required");

      const hasAudio = Boolean(form.audioFile);
      const hasVideo = Boolean(form.videoFile);
      if (!hasAudio || !hasVideo) {
        throw new Error("Both Audio and Video files are required for this post.");
      }

      const fd = new FormData();
      fd.append("title", title);
      fd.append("genre", genre);
      fd.append("thumbnail", form.thumbnailFile);
      fd.append("audio", form.audioFile as File);
      fd.append("video", form.videoFile as File);

      const res = await http.post<UploadResponse>("/api/v1/content/upload", fd, {
        headers: {
          "Content-Type": undefined as any
        }
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Upload failed");
      }

      setSuccess("Post is now Live on Fan App!");

      setForm({ title: "", genre: "", thumbnailFile: null, audioFile: null, videoFile: null });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full" style={backgroundStyle}>
      <div className="rounded-[10px] border border-white/10 bg-[#141010]/35 backdrop-blur px-7 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[18px] font-light tracking-wide">Content Upload</div>
            <div className="mt-1 text-[13px] text-[#b8a6a1]">Upload audio and video with local previews. New posts go live immediately.</div>
          </div>
        </div>

        {error ? <div className="mt-4 text-[13px] text-[#e3a1a1]">{error}</div> : null}
        {success ? <div className="mt-4 text-[13px] text-emerald-200">{success}</div> : null}

        <div className="mt-6">
          <UnifiedUploadSection
            value={form}
            onChange={setForm}
            onPost={() => post()}
            onError={(m) => {
              setError(m);
              if (m) setSuccess(null);
            }}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}
