import { requestPlaybackAccess } from "../modules/media/media-access.service";
import { pool } from "../common/db";

async function main() {
  console.log("=== Testing Playback for User 100 & 101 ===");

  for (const item of [
    { id: 12, kind: "audio" as const, user: 100, title: "Khairit Audio (Arijit)" },
    { id: 13, kind: "video" as const, user: 100, title: "Khairit Video (Arijit)" },
    { id: 18, kind: "audio" as const, user: 101, title: "Barbaad Audio (Jubin)" },
    { id: 20, kind: "video" as const, user: 101, title: "Barbaad Video (Jubin)" },
  ]) {
    try {
      const res = await requestPlaybackAccess({
        contentId: item.id,
        userId: item.user,
        kind: item.kind,
      });
      console.log(`[PASS] ${item.title} (ID: ${item.id})`);
      console.log(`       Mode: ${res.playbackMode}`);
      console.log(`       URL: ${res.playbackUrl.substring(0, 70)}...`);
      console.log(`       Duration: ${res.durationMs}ms`);
      console.log(`       Qualities: ${JSON.stringify(res.qualities)}`);
    } catch (err: any) {
      console.error(`[FAIL] ${item.title} (ID: ${item.id}):`, err.message);
    }
  }
}

main().catch(console.error).finally(() => pool.end());
