// src/pages/ArtistContentUploadPage.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { http } from "../services/http";
import {
  Upload,
  Music,
  Video,
  Image as ImageIcon,
  Lock,
  Unlock,
  ChevronDown,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Play,
  FileAudio,
  FileVideo,
  Album,
  Radio,
} from "lucide-react";

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
  "Other",
];

function buildObjectUrl(file: File | null) {
  if (!file) return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function GenreCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useCallback(() => {
    const q = (inputValue || "").trim().toLowerCase();
    if (!q) return GENRES;
    return GENRES.filter((g) => g.toLowerCase().includes(q));
  }, [inputValue]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    setOpen(true);
  };

  const handleSelect = (g: string) => {
    setInputValue(g);
    onChange(g);
    setOpen(false);
    inputRef.current?.blur();
  };

  const suggestions = filtered();

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-[52px] w-full rounded-xl border border-white/10 bg-[#0A0A0A]/60 overflow-hidden focus-within:border-[#E85D2C]/50 transition-all">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder="Type or select a genre…"
          className="flex-1 h-full bg-transparent px-4 text-sm text-white placeholder-[#6b5b57] outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            if (!open) inputRef.current?.focus();
          }}
          className="flex items-center justify-center px-3 text-[#8D7B77] hover:text-[#E85D2C] transition-colors">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden">
          {inputValue.trim() &&
            !GENRES.map((g) => g.toLowerCase()).includes(
              inputValue.trim().toLowerCase()
            ) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(inputValue.trim());
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#E85D2C] hover:bg-white/5 transition-colors border-b border-white/5">
                <span className="text-sm">✏️</span>
                Use "<strong>{inputValue.trim()}</strong>" as custom genre
              </button>
            )}
          {suggestions.length > 0 ? (
            <ul className="max-h-[220px] overflow-y-auto">
              {suggestions.map((g) => (
                <li key={g}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(g);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${
                      inputValue === g
                        ? "text-[#E85D2C] bg-[#E85D2C]/10"
                        : "text-white"
                    }`}>
                    {g}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-[#6b5b57]">
              No matching genres
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileDropZone({
  label,
  icon: Icon,
  file,
  onFileSelect,
  accept,
  className = "",
}: {
  label: string;
  icon: React.ElementType;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#B8A6A1] mb-2 font-medium">
        {label}
      </label>
      <div
        className={`h-[120px] rounded-xl border-2 border-dashed border-white/20 bg-[#0A0A0A]/40 flex flex-col items-center justify-center cursor-pointer hover:border-[#E85D2C]/40 hover:bg-[#E85D2C]/5 transition-all ${className}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.length) onFileSelect(files[0]);
        }}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            onFileSelect(f);
            if (e.target) e.target.value = "";
          }}
        />
        <Icon className="w-8 h-8 text-[#6b5b57] mb-2" />
        <div className="text-sm font-medium text-white text-center px-2">
          {file?.name || `Click or drag to upload ${label.toLowerCase()}`}
        </div>
        <div className="text-xs text-[#6b5b57] mt-1">
          {accept.split(",").join(" ")}
        </div>
      </div>
    </div>
  );
}

function UnifiedUploadSection({
  value,
  onChange,
  onPost,
  onError,
  busy,
}: {
  value: UploadFormState;
  onChange: (next: UploadFormState) => void;
  onPost: () => void;
  onError: (message: string | null) => void;
  busy: boolean;
}) {
  const thumbnailPreviewUrl = useMemo(
    () => buildObjectUrl(value.thumbnailFile),
    [value.thumbnailFile]
  );
  const audioPreviewUrl = useMemo(
    () => buildObjectUrl(value.audioFile),
    [value.audioFile]
  );
  const videoPreviewUrl = useMemo(
    () => buildObjectUrl(value.videoFile),
    [value.videoFile]
  );

  const canPost = Boolean(
    (value.title || "").trim() &&
      (value.genre || "").trim() &&
      value.thumbnailFile &&
      value.audioFile &&
      value.videoFile
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-[#15100E] overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#E85D2C]" />
            Upload Track
          </div>
          <div className="mt-0.5 text-sm text-[#B8A6A1]">
            Upload your audio, video, and cover art. Your release will be
            processed and live in seconds.
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="space-y-6 lg:col-span-3">
          {/* Track Title */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#B8A6A1] mb-2 font-medium">
              Track Title <span className="text-[#E85D2C]">*</span>
            </label>
            <input
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              className="w-full h-[52px] rounded-xl bg-[#0A0A0A]/60 border border-white/10 px-5 text-sm text-white placeholder-[#6b5b57] outline-none focus:border-[#E85D2C]/50 transition-all"
              placeholder="e.g. Midnight City"
              autoFocus
            />
          </div>

          {/* Genre */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#B8A6A1] mb-2 font-medium">
              Genre <span className="text-[#E85D2C]">*</span>
            </label>
            <GenreCombobox
              value={value.genre}
              onChange={(g) => onChange({ ...value, genre: g })}
            />
          </div>

          {/* Cover Art */}
          <FileDropZone
            label="Cover Art"
            icon={ImageIcon}
            file={value.thumbnailFile}
            onFileSelect={(f) => onChange({ ...value, thumbnailFile: f })}
            accept="image/*"
          />

          {/* Audio & Video */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileDropZone
              label="Audio File (MP3)"
              icon={FileAudio}
              file={value.audioFile}
              onFileSelect={(f) => onChange({ ...value, audioFile: f })}
              accept=".mp3"
            />
            <FileDropZone
              label="Video File (MP4/WEBM)"
              icon={FileVideo}
              file={value.videoFile}
              onFileSelect={(f) => onChange({ ...value, videoFile: f })}
              accept="video/mp4,video/webm"
            />
          </div>

          {/* Subscriber Toggle */}
          <div className="rounded-xl border border-[#E85D2C]/20 bg-[#E85D2C]/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#E85D2C]/20 border border-[#E85D2C]/30 flex items-center justify-center">
                {value.isSubscriberOnly ? (
                  <Lock className="w-5 h-5 text-[#E85D2C]" />
                ) : (
                  <Unlock className="w-5 h-5 text-[#E85D2C]" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  Subscriber Only Content
                </div>
                <div className="text-xs text-[#B8A6A1]">
                  Only active subscribers can play this track
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  isSubscriberOnly: !value.isSubscriberOnly,
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                value.isSubscriberOnly
                  ? "bg-[#E85D2C]"
                  : "bg-[#0A0A0A]/80 border border-white/10"
              }`}>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  value.isSubscriberOnly ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            disabled={busy || !canPost}
            onClick={onPost}
            className="w-full h-[56px] rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-white font-semibold shadow-lg shadow-[#E85D2C]/25 hover:shadow-[#E85D2C]/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {busy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Publish Track
              </>
            )}
          </button>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-[#0A0A0A]/60 p-6">
            <h3 className="text-xs uppercase tracking-wider text-[#B8A6A1] font-medium mb-6 flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#E85D2C]" />
              Preview
            </h3>

            <div className="h-[200px] w-[200px] mx-auto rounded-2xl overflow-hidden shadow-xl bg-[#0A0A0A] mb-6">
              {thumbnailPreviewUrl ? (
                <img
                  src={thumbnailPreviewUrl}
                  alt="Cover"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#6b5b57]">
                  <Album className="w-12 h-12 mb-2" />
                  <span className="text-xs">No Cover Art</span>
                </div>
              )}
            </div>

            <div className="text-center mb-6">
              <h4 className="text-xl font-semibold text-white truncate">
                {value.title || "Untitled Track"}
              </h4>
              <p className="text-sm text-[#E85D2C] mt-1">
                {value.genre || "Genre"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs text-[#B8A6A1] uppercase tracking-wide font-medium flex items-center gap-2">
                  <Music className="w-4 h-4" /> Audio
                </span>
                {audioPreviewUrl ? (
                  <audio
                    controls
                    className="w-full h-[40px] mt-2 rounded-lg"
                    src={audioPreviewUrl}
                  />
                ) : (
                  <div className="h-[40px] flex items-center justify-center text-xs text-[#6b5b57] bg-[#0A0A0A]/50 rounded-lg mt-2">
                    No audio loaded
                  </div>
                )}
              </div>
              <div>
                <span className="text-xs text-[#B8A6A1] uppercase tracking-wide font-medium flex items-center gap-2">
                  <Video className="w-4 h-4" /> Video
                </span>
                {videoPreviewUrl ? (
                  <video
                    controls
                    className="w-full h-[140px] rounded-lg bg-black mt-2"
                    src={videoPreviewUrl}
                  />
                ) : (
                  <div className="h-[140px] flex items-center justify-center text-xs text-[#6b5b57] bg-[#0A0A0A]/50 rounded-lg mt-2">
                    No video loaded
                  </div>
                )}
              </div>
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
    videoFile: null,
    isSubscriberOnly: false,
  });

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(circle at 30% 10%, rgba(232,93,44,0.06) 0%, rgba(10,10,10,0.95) 100%)",
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

      const res = await http.post<UploadResponse>(
        "/api/v1/content/upload",
        fd,
        {
          headers: {
            "Content-Type": undefined as any,
          },
        }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Upload failed");
      }

      setSuccess(
        "Your release has been uploaded and is currently Under Review!"
      );
      setForm({
        title: "",
        genre: "",
        thumbnailFile: null,
        audioFile: null,
        videoFile: null,
        isSubscriberOnly: false,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full animate-fadeIn" style={backgroundStyle}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#E85D2C]" />
              New Release
            </h1>
            <p className="mt-1 text-sm text-[#B8A6A1]">
              Share your latest master track alongside a visual experience.
            </p>
          </div>
          <Link
            to="/artist/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-[#B8A6A1] hover:text-white hover:bg-white/5 transition-all">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-emerald-300">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{success}</span>
            </div>
            <Link
              to="/artist/dashboard"
              className="px-6 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-semibold transition-colors whitespace-nowrap">
              Back to Dashboard
            </Link>
          </div>
        )}

        {/* Upload Section */}
        <UnifiedUploadSection
          value={form}
          onChange={setForm}
          onPost={post}
          onError={(m) => {
            setError(m);
            if (m) setSuccess(null);
          }}
          busy={busy}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
