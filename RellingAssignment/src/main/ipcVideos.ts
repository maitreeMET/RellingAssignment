// src/main/ipcVideos.ts
import { ipcMain, dialog, BrowserWindow, shell } from "electron";
import fs from "node:fs";
import { listVideos, getVideo, updateVideoStatus, getClipJob, listClips, deleteVideo } from "./db/queries";
import { importVideoFromFilePickerPath } from "./videoImport";
import { extractAndPersistMetadata } from "./metadataPipeline";
import { generateClipsForVideo } from "./clipPipeline";
import { backfillClipMetadata } from "./clipMetadataBackfill";
import { getClipsDir, getVideoDir } from "./paths";


export function registerVideoIpcHandlers() {
  // 1) list videos
  ipcMain.handle("videos:list", () => {
    return listVideos();
  });

  // 2) open file picker + import
  ipcMain.handle("videos:import", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      return { ok: false, error: "No active window found." };
    }

    const result = await dialog.showOpenDialog(win, {
      title: "Select an MP4 video",
      properties: ["openFile"],
      filters: [{ name: "MP4 Videos", extensions: ["mp4"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, canceled: true as const };
    }

    const pickedPath = result.filePaths[0];
    const imported = importVideoFromFilePickerPath(pickedPath);

    if (!imported.ok) {
      return { ok: false, error: imported.error };
    }

    // return the inserted row for UI convenience
    const video = getVideo(imported.video_id);

    // fire and forget metadata extraction
    extractAndPersistMetadata(imported.video_id).catch(() => {
      // errors are already saved to DB via setVideoError
    });

    return { ok: true, canceled: false as const, video };
  });

  // 3) manually re-extract metadata
  ipcMain.handle("videos:extractMetadata", async (_evt, video_id: string) => {
    await extractAndPersistMetadata(video_id);
    return { ok: true };
  });

  // 4) get a single video by ID
  ipcMain.handle("videos:get", async (_evt, video_id: string) => {
    return getVideo(video_id);
  });

  // 5) set video status (approve/reject/pending)
  ipcMain.handle("videos:setStatus", async (_evt, video_id: string, status: "Approved" | "Rejected" | "Pending") => {
    const updated = updateVideoStatus(video_id, status);

    if (status === "Approved") {
      // fire-and-forget so UI doesn't freeze
      generateClipsForVideo(video_id).catch(() => {
        // errors are persisted to DB via setClipJobState/setVideoError
      });
    }

    return updated;
  });

  // 6) get original video URL for playback
  ipcMain.handle("videos:getOriginalUrl", async (_evt, video_id: string) => {
    // Return custom media:// protocol URL
    return `media://video/${video_id}/original`;
  });

  // 7) get clip job status
  ipcMain.handle("clips:getJob", async (_evt, video_id: string) => {
    return getClipJob(video_id); // may be null
  });

  // 8) list clips for a video
  ipcMain.handle("clips:list", async (_evt, video_id: string) => {
    return listClips(video_id);
  });

  // 9) manually trigger clip generation
  ipcMain.handle("clips:generate", async (_evt, video_id: string) => {
    generateClipsForVideo(video_id).catch(() => {});
    return { ok: true };
  });

  // 10) backfill clip metadata
  ipcMain.handle("clips:backfillMetadata", async (_evt, video_id: string) => {
    const res = await backfillClipMetadata(video_id);
    return { ok: true, ...res };
  });

  // 11) get playable URL for a clip
  ipcMain.handle("clips:getUrl", async (_evt, video_id: string, clip_index: number) => {
    return `media://video/${video_id}/clip/${clip_index}`;
  });

  // 12) reveal video in file explorer
  ipcMain.handle("debug:revealVideoDir", async (_evt, video_id: string) => {
    const v = getVideo(video_id);
    // reveal original in folder
    shell.showItemInFolder(v.original_path);
    return { ok: true };
  });

  // 13) open clips directory
  ipcMain.handle("debug:revealClipsDir", async (_evt, video_id: string) => {
    const dir = getClipsDir(video_id);
    shell.openPath(dir);
    return { ok: true };
  });

  // 14) delete one or more videos (and their files)
  ipcMain.handle("videos:delete", async (_evt, video_ids: string[]) => {
    for (const video_id of video_ids) {
      // Delete file system first
      const videoDir = getVideoDir(video_id);
      fs.rmSync(videoDir, { recursive: true, force: true });
      // Delete from DB (CASCADE handles clips and clip_jobs)
      deleteVideo(video_id);
    }
    return { ok: true, deleted: video_ids.length };
  });
}

