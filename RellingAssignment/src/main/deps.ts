// src/main/deps.ts
import { spawnSync } from "node:child_process";

function hasCommand(cmd: string): boolean {
  const result = spawnSync(cmd, ["-version"], {
    stdio: "ignore",
    shell: process.platform === "win32", // helps on Windows PATH resolution
  });
  return result.status === 0;
}

export function assertFfmpegAvailable(): void {
  const okFfmpeg = hasCommand("ffmpeg");
  const okFfprobe = hasCommand("ffprobe");

  if (!okFfmpeg || !okFfprobe) {
    throw new Error(
      "Missing dependencies: ffmpeg/ffprobe not found on PATH.\n\n" +
        "Install ffmpeg, make sure 'ffmpeg' and 'ffprobe' work in your terminal, then restart the app."
    );
  }
}
