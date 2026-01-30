import { listVideos, getClipJob, setClipJobState } from "./db/queries";

const STALE_MS = 10 * 60 * 1000; // 10 minutes

export function recoverStaleJobs(): void {
  const vids = listVideos();
  const now = Date.now();

  for (const v of vids) {
    const job = getClipJob(v.video_id);
    if (!job) continue;

    if (job.state === "Generating") {
      const updated = Date.parse(job.updated_at);
      if (Number.isFinite(updated) && now - updated > STALE_MS) {
        setClipJobState(v.video_id, "Failed", {
          stderr: `Recovery: job was Generating but stale for > ${STALE_MS / 60000} minutes.`,
          exitCode: null,
        });
      }
    }
  }
}
