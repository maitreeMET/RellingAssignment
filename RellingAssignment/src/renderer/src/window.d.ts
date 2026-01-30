// src/renderer/src/window.d.ts
export {};

type VideoStatus = "Pending" | "Approved" | "Rejected";

type VideoRow = {
  video_id: string;
  created_at: string;
  filename: string;
  original_path: string;
  status: VideoStatus;
  metadata_json: string | null;
  rotation_raw: string | null;
  error_message: string | null;
};

type ClipJobState = "NotStarted" | "Generating" | "Done" | "Failed";

type ClipJobRow = {
  video_id: string;
  state: ClipJobState;
  last_stderr: string | null;
  last_exit_code: number | null;
  updated_at: string;
} | null;

type ClipRow = {
  clip_id: string;
  video_id: string;
  clip_index: number;
  path: string;
  duration: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
};

declare global {
  interface Window {
    api: {
      listVideos: () => Promise<VideoRow[]>;
      importVideo: () => Promise<
        | { ok: true; canceled: true }
        | { ok: true; canceled: false; video: VideoRow }
        | { ok: false; error: string }
      >;
      extractMetadata: (video_id: string) => Promise<{ ok: true }>;
      getVideo: (video_id: string) => Promise<VideoRow>;
      setVideoStatus: (video_id: string, status: VideoStatus) => Promise<VideoRow>;
      deleteVideos: (video_ids: string[]) => Promise<{ ok: true; deleted: number }>;
      getOriginalUrl: (video_id: string) => Promise<string>;
      getClipJob: (video_id: string) => Promise<ClipJobRow>;
      listClips: (video_id: string) => Promise<ClipRow[]>;
      generateClips: (video_id: string) => Promise<{ ok: true }>;
      backfillClipMetadata: (video_id: string) => Promise<{ ok: true; scanned: number; upserted: number }>;
      getClipUrl: (clipPath: string) => Promise<string>;
      revealVideoDir: (video_id: string) => Promise<{ ok: true }>;
      revealClipsDir: (video_id: string) => Promise<{ ok: true }>;
    };
  }
}
