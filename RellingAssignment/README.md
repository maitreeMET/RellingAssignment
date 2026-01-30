# Relling Take-Home — Video QA + Clip Generator (Local)

A local-only video pipeline for uploading MP4s, reviewing them in a QA view, and automatically generating contiguous 2-minute clips after approval. The app stores everything on disk + SQLite (no external services).

## What you can do in the app

### Upload + manage videos
- Upload **MP4** files (non-MP4 uploads are rejected with a clear error)
- Dashboard shows:
  - filename
  - created timestamp
  - status (**Pending / Approved / Rejected**)
  - metadata readiness
- Quality-of-life controls on the dashboard:
  - search by filename
  - filter by status
  - sort (newest first)

### QA review
- Open a QA page for any video to:
  - play the original video
  - view extracted metadata (duration, fps, resolution, aspect ratio, codec/container, file size, rotation raw value)
  - approve or reject (persisted in SQLite and survives restarts)

### Clip generation (automatic on approve)
- When a video is **Approved**, the app generates contiguous 2-minute clips:
  - `clip_000.mp4`, `clip_001.mp4`, ...
  - last clip may be shorter depending on duration
- Progress/state is shown in the QA view (e.g., **Complete**)
- Clip generation is **idempotent**: existing clips are reused (it won’t regenerate work unnecessarily)

### Browse clips
- Dedicated Clips page per video:
  - lists all generated clips
  - plays clips
  - shows clip metadata (duration, fps, resolution, file size)

### Debugging / UX tools
These are meant to make the app easier to inspect and troubleshoot during review:
- “Open Video Folder” and “Open Clips Folder” buttons
- “Re-scan Metadata” button (repairs / repopulates clip metadata in DB from existing clip files)



## Prerequisites
- Node.js (LTS)
- `ffmpeg` and `ffprobe` available on your PATH  
  - quick check:
    ```bash
    ffmpeg -version
    ffprobe -version
    ```


## Run locally
```bash
npm install
npm run dev
