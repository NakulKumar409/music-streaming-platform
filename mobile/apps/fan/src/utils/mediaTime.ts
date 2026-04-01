export function toFiniteDurationMs(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value));
}

export function hasFiniteDuration(durationMs: number): boolean {
  return Number.isFinite(durationMs) && durationMs > 0;
}

export function formatDurationLabel(ms: number, fallback = "--:--"): string {
  if (!Number.isFinite(ms) || ms < 0) return fallback;
  const totalSeconds = Math.floor(ms / 1000);
  if (!Number.isFinite(totalSeconds)) return fallback;
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return fallback;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

