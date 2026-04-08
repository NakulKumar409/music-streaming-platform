import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  isSubscriberOnly: boolean;
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
    return ext === ".mp4" || ext === ".webm" || file.type.startsWith("video/");
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
      onError("Invalid video file type. Please select a .mp4 or .webm file.");
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

    if (kind === "VIDEO") {
      setVideoFile(f);
      return;
    }
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

    if (kind === "VIDEO") {
      setVideoFile(f);
      return;
    }
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
          <div className="text-[17px] font-medium tracking-wide text-[#e6d6d2]">Upload Track</div>
          <div className="mt-1 text-[13px] text-[#b8a6a1]">
            Upload your audio, video, and cover art. Your release will be processed and live in seconds.
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="space-y-6 lg:col-span-3">
          <div>
            <label className="block text-[13px] uppercase tracking-widest text-[#b8a6a1]">Track Title</label>
            <input
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              className="mt-2 w-full h-[48px] rounded-[8px] border border-white/10 bg-[#141010]/55 px-4 text-[14px] text-[#f0e5e2] outline-none focus:border-[#7a3f31]/60 transition-colors"
              placeholder="e.g. Midnight City"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[13px] uppercase tracking-widest text-[#b8a6a1]">Genre</label>
            <input
              list="genre-options"
              value={value.genre}
              onChange={(e) => onChange({ ...value, genre: e.target.value })}
              className="mt-2 w-full h-[48px] rounded-[8px] border border-white/10 bg-[#141010]/55 px-4 text-[14px] text-[#f0e5e2] outline-none focus:border-[#7a3f31]/60 transition-colors"
              placeholder="Start typing or select a genre..."
            />
            <datalist id="genre-options">
              {GENRES.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[13px] uppercase tracking-widest text-[#b8a6a1]">Cover Art</label>
            <div
              tabIndex={0}
              onPaste={(e) => onPasteZone(e, "THUMBNAIL")}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => onDropZone(e, "THUMBNAIL")}
              className="mt-2 h-[120px] rounded-[10px] border border-dashed border-white/20 bg-[#141010]/35 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => thumbnailInputRef.current?.click()}
            >
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
              <div className="text-[28px] mb-2 opacity-60">🖼️</div>
              <div className="text-[13px] font-medium text-[#e6d6d2]">
                {value.thumbnailFile?.name || "Click or drop image"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] uppercase tracking-widest text-[#b8a6a1]">Audio File (MP3)</label>
              <div
                tabIndex={0}
                onPaste={(e) => onPasteZone(e, "AUDIO")}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => onDropZone(e, "AUDIO")}
                className="mt-2 h-[120px] rounded-[10px] border border-dashed border-white/20 bg-[#141010]/35 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors p-4 text-center"
                onClick={() => audioInputRef.current?.click()}
              >
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
                <div className="text-[28px] mb-2 opacity-60">🎵</div>
                <div className="text-[13px] font-medium text-[#e6d6d2] line-clamp-2">
                  {value.audioFile?.name || "Click or drop .mp3 file"}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] uppercase tracking-widest text-[#b8a6a1]">Video File (MP4/WEBM)</label>
              <div
                tabIndex={0}
                onPaste={(e) => onPasteZone(e, "VIDEO")}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => onDropZone(e, "VIDEO")}
                className="mt-2 h-[120px] rounded-[10px] border border-dashed border-white/20 bg-[#141010]/35 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors p-4 text-center"
                onClick={() => videoInputRef.current?.click()}
              >
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setVideoFile(f);
                  }}
                />
                <div className="text-[28px] mb-2 opacity-60">🎬</div>
                <div className="text-[13px] font-medium text-[#e6d6d2] line-clamp-2">
                  {value.videoFile?.name || "Click or drop video file"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#c97a54]/20 bg-[#6a352c]/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#6a352c]/20 border border-[#c97a54]/30 flex items-center justify-center text-[18px]">🔒</div>
              <div>
                <div className="text-[14px] font-medium text-[#e6d6d2]">Subscriber Only Content</div>
                <div className="text-[12px] text-[#b8a6a1]">Only your active subscribers will be able to play this track.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...value, isSubscriberOnly: !value.isSubscriberOnly })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                value.isSubscriberOnly ? 'bg-[#c97a54]' : 'bg-[#141010]/80 border border-white/10'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  value.isSubscriberOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <button

            type="button"
            disabled={busy || !canPost}
            onClick={onPost}
            className="w-full mt-4 h-[54px] rounded-[8px] border border-[#7a3f31]/30 bg-gradient-to-b from-[#6a352c] to-[#3d1e18] px-4 text-[16px] font-medium tracking-wide text-white shadow-[0_10px_25px_rgba(0,0,0,0.25)] hover:shadow-[0_15px_30px_rgba(106,53,44,0.4)] disabled:opacity-60 transition-all hover:-translate-y-0.5"
          >
            {busy ? "Uploading..." : "Publish Track"}
          </button>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-[10px] border border-[#7a3f31]/10 bg-gradient-to-b from-[#141010]/60 to-[#0a0808]/80 p-6 flex flex-col items-center justify-center shadow-inner h-full">
            <h3 className="text-[14px] uppercase tracking-widest text-[#b8a6a1] mb-6 w-full text-left">Preview</h3>

            <div className="h-[200px] w-[200px] sm:h-[240px] sm:w-[240px] rounded-[20px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[#141010] mb-8 group relative aspect-square">
              {thumbnailPreviewUrl ? (
                <img src={thumbnailPreviewUrl} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#8d7b77]">
                  <span className="text-4xl mb-2">🎧</span>
                  <span className="text-xs">No Cover Art</span>
                </div>
              )}
            </div>

            <div className="w-full text-center mb-6">
              <h4 className="text-[20px] font-medium text-white truncate px-4">
                {value.title || "Untitled Track"}
              </h4>
              <p className="text-[14px] text-[#c97a54] mt-1">{value.genre || "Genre"}</p>
            </div>

            <div className="w-full max-w-sm bg-[#0e0a0a]/50 p-4 rounded-[12px] border border-white/5 space-y-4 flex-1">
              <div className="w-full">
                <span className="text-xs text-[#b8a6a1] mb-2 block uppercase tracking-wide font-medium">Audio</span>
                {audioPreviewUrl ? (
                  <audio controls className="w-full h-[40px] outline-none custom-audio-player" src={audioPreviewUrl} />
                ) : (
                  <div className="h-[40px] flex items-center justify-center text-[12px] text-[#8d7b77] bg-[#141010]/50 rounded-[8px]">
                    No audio loaded
                  </div>
                )}
              </div>
              <div className="w-full">
                <span className="text-xs text-[#b8a6a1] mb-2 block uppercase tracking-wide font-medium">Video</span>
                {videoPreviewUrl ? (
                  <video controls className="w-full h-[160px] outline-none rounded-[8px] bg-black" src={videoPreviewUrl} />
                ) : (
                  <div className="h-[160px] flex items-center justify-center text-[12px] text-[#8d7b77] bg-[#141010]/50 rounded-[8px]">
                    No video loaded
                  </div>
                )}
              </div>
            </div>
            
            {/* Inline style specifically for the custom audio player */}
            <style>{`
              .custom-audio-player::-webkit-media-controls-panel {
                background-color: transparent;
              }
              .custom-audio-player::-webkit-media-controls-current-time-display,
              .custom-audio-player::-webkit-media-controls-time-remaining-display {
                color: #e6d6d2;
              }
            `}</style>
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
    videoFile: null,
    isSubscriberOnly: false
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
      if (!form.thumbnailFile) throw new Error("Cover Art is required");
      if (!form.audioFile) throw new Error("Audio File is required");
      if (!form.videoFile) throw new Error("Video File is required");

      const fd = new FormData();
      fd.append("title", title);
      fd.append("genre", genre);
      fd.append("thumbnail", form.thumbnailFile);
      fd.append("audio", form.audioFile);
      fd.append("video", form.videoFile);
      fd.append("isSubscriberOnly", String(form.isSubscriberOnly));


      const res = await http.post<UploadResponse>("/api/v1/content/upload", fd, {
        headers: {
          "Content-Type": undefined as any
        }
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Upload failed");
      }

      setSuccess("Your release has been uploaded and is currently Under Review!");

      setForm({ title: "", genre: "", thumbnailFile: null, audioFile: null, videoFile: null, isSubscriberOnly: false });

    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full" style={backgroundStyle}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-[28px] font-light tracking-wide text-white">New Release</h1>
            <p className="mt-1 text-[14px] text-[#b8a6a1]">Share your latest master track alongside a visual experience.</p>
          </div>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-[8px] bg-red-950/40 border border-red-900/50 text-[14px] text-[#fca5a5] flex items-center">
            <span className="mr-2">⚠️</span> {error}
          </div>
        ) : null}
        
        {success ? (
          <div className="mb-6 rounded-[8px] bg-[#10b981]/15 border border-[#10b981]/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center text-[15px] text-[#34d399]">
              <span className="mr-3 text-2xl">🎉</span> 
              <span>{success}</span>
            </div>
            <Link
              to="/artist/dashboard"
              className="px-6 py-2 bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] rounded-full text-[14px] font-semibold transition-colors whitespace-nowrap"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : null}

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
  );
}
