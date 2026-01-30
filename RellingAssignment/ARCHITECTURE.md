# Architecture

## Overview

Electron desktop app for video QA workflows. Upload MP4s, review metadata, approve/reject, and auto-generate 2-minute clips from approved videos.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + React Router
- **Backend:** Electron main process (Node.js)
- **Database:** SQLite via better-sqlite3
- **Video Processing:** ffmpeg/ffprobe CLI tools

## Directory Structure

```
src/
├── main/           # Electron main process
│   ├── db/         # SQLite schema & queries
│   ├── utils/      # Shell command runner
│   ├── clipPipeline.ts    # Clip generation logic
│   ├── videoImport.ts     # File import & validation
│   ├── metadataPipeline.ts # ffprobe metadata extraction
│   └── ipcVideos.ts       # IPC handlers
├── preload/        # Context bridge for IPC
└── renderer/       # React UI
    └── pages/      # Dashboard, QaView, ClipsView
```

**Data Storage:**
```
data/
├── app.db          # SQLite database
├── videos/
│   └── <video_id>/
│       ├── original.mp4
│       └── clips/
│           ├── clip_000.mp4
│           ├── clip_001.mp4
│           └── ...
└── logs/           # ffmpeg/ffprobe error logs
```

## Design Decisions

### SQLite over JSON
I went with SQLite (better-sqlite3) instead of a simple JSON file store. Yeah, it adds native module complexity and requires rebuilding for Electron, but I get ACID transactions, proper indexing, and it'll actually scale if the video library grows.

### File Copy Instead of Symlink
Videos get copied to `data/videos/<id>/original.mp4` rather than symlinked. Takes more disk space, but means I don't break anything if the user moves or deletes their source file. Deterministic paths make everything simpler.

### Async Clip Generation
When you approve a video, clip generation kicks off in the background. The UI stays responsive and you can keep working, but you'll need to refresh to see when it's done. Could add WebSocket-based real-time updates later, but polling works fine for now.

### Re-encoding Clips
Clips are re-encoded with libx264 rather than using `-c copy` stream copying. Slower, but guarantees consistent output and avoids the keyframe alignment headaches that cause playback glitches with stream copy.

### IPC Path Validation
The `clips:getUrl` and `videos:getOriginalUrl` handlers validate that requested paths start with `data/videos/`. Prevents the renderer from accessing arbitrary files on disk.

### Cascade Deletes
When deleting videos, the database uses `ON DELETE CASCADE` for clips and clip_jobs tables. The IPC handler removes the file system directory first, then the DB row. Clean and atomic.

## Current Limitations

- **No progress bar for clip generation** - You see Generating/Done/Failed states, but not "42% complete"
- **No global processing queue** - Each approved video runs its own clip pipeline independently
- **Desktop only** - Single user, no web/multi-user support
- **MP4 only** - Other containers (MKV, AVI, MOV) are rejected at import
- **No rotation normalization** - See below

## Rotation Handling

Phone recordings often store orientation as metadata (rotate tag or display matrix) rather than actually rotating the pixels. I:

1. Extract the raw rotation value from ffprobe
2. Display it in the QA view so reviewers can see it
3. Preserve the original file untouched

Different players interpret rotation metadata differently, so I don't force any transformation. A future improvement could offer a "normalized playback" toggle or generate a rotation-corrected copy while keeping the original for provenance.
