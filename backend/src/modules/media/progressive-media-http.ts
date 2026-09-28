export function inferContentTypeFromKey(
  storageKey: string | null | undefined
): string | null {
  if (!storageKey) return null;
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return null;
}

export function normalizeStreamContentType(
  value: string | null | undefined,
  storageKey: string | null | undefined,
  fallback: string | null | undefined
): string {
  const normalize = (candidate: string | null | undefined) => {
    const raw = String(candidate || "").trim().toLowerCase();
    if (!raw) return null;

    // Progressive MP3/M4A/MP4 delivery does not need codec parameters here.
    // Strip malformed/empty parameters such as "audio/x-m4a; codecs=".
    const base = raw.split(";")[0]?.trim() || "";
    if (!base || base === "application/octet-stream") return null;
    if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
    if (base === "audio/mp3") return "audio/mpeg";
    return base;
  };

  return (
    normalize(value) ||
    inferContentTypeFromKey(storageKey) ||
    normalize(fallback) ||
    "application/octet-stream"
  );
}

export function parseSingleByteRange(
  header: string,
  totalLength: number
): { start: number; end: number } | null {
  if (!Number.isSafeInteger(totalLength) || totalLength <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return null;

  // RFC 9110 suffix-byte-range-spec: "bytes=-N" means the final N bytes.
  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    const boundedLength = Math.min(suffixLength, totalLength);
    return {
      start: totalLength - boundedLength,
      end: totalLength - 1,
    };
  }

  const start = Number(startRaw);
  const requestedEnd = endRaw ? Number(endRaw) : totalLength - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= totalLength
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(requestedEnd, totalLength - 1),
  };
}
