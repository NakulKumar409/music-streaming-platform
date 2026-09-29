export type PendingAudioSeek = {
  generation: number;
  targetMs: number;
};

export type AudioProgressDecisionInput = {
  positionMs: number;
  generationAtRead?: number;
  currentGeneration: number;
  pendingSeek: PendingAudioSeek | null;
  toleranceMs?: number;
};

export type AudioProgressDecision = {
  accept: boolean;
  confirmsSeek: boolean;
};

export const AUDIO_SEEK_CONFIRM_TOLERANCE_MS = 1000;

/**
 * Decides whether a playback-engine progress sample is allowed to update UI
 * state. This is deliberately pure so stale-read/seek races are testable.
 */
export function evaluateAudioProgressSample({
  positionMs,
  generationAtRead,
  currentGeneration,
  pendingSeek,
  toleranceMs = AUDIO_SEEK_CONFIRM_TOLERANCE_MS,
}: AudioProgressDecisionInput): AudioProgressDecision {
  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return { accept: false, confirmsSeek: false };
  }

  // Any async read started before the latest seek/reset belongs to an older
  // playback generation and must never overwrite current state.
  if (
    generationAtRead !== undefined &&
    generationAtRead !== currentGeneration
  ) {
    return { accept: false, confirmsSeek: false };
  }

  if (!pendingSeek) {
    return { accept: true, confirmsSeek: false };
  }

  if (pendingSeek.generation !== currentGeneration) {
    return { accept: false, confirmsSeek: false };
  }

  const confirmsSeek =
    Math.abs(positionMs - pendingSeek.targetMs) <= Math.max(0, toleranceMs);

  return {
    accept: confirmsSeek,
    confirmsSeek,
  };
}
