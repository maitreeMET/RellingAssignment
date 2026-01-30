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
```

## AI LOG

I structured the overall system and workflow myself and like deciding how state moves from upload, QA, approval, clip generation, how data is laid out on disk, and how persistence works across restarts. 

In several places, AI-generated suggestions weren’t directly usable, especially around Electron media playback, IPC boundaries, and idempotent clip generation. Those parts required manual debugging, iteration, and testing against real videos.

I also had to override or refine AI output when it suggested approaches that were either insecure (for example, disabling web security for playback) or too generic. In those cases, I opted for cleaner solutions, like using a custom media protocol and explicit filesystem guards.

Overall, AI helped speed up iteration and reduce boilerplate, but the final architecture, UX decisions, and edge-case handling were implemented and validated manually.

I used claude code by the way.