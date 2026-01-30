// src/main/ffprobe.ts
import { runCommand } from "./utils/runCommand";

export type FfprobeJson = {
  streams?: any[];
  format?: any;
};

export async function runFfprobe(filePath: string): Promise<FfprobeJson> {
  const args = [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ];

  const res = await runCommand("ffprobe", args, { timeoutMs: 60_000 });

  if (res.exitCode !== 0) {
    // include stderr to make debugging easy
    throw new Error(
      `ffprobe failed (exit=${res.exitCode}).\n` +
        (res.stderr.trim() ? `stderr:\n${res.stderr.trim()}` : "No stderr output.")
    );
  }

  try {
    return JSON.parse(res.stdout);
  } catch (e: any) {
    throw new Error(
      `ffprobe returned non-JSON output.\n` +
        `Parse error: ${e?.message ?? String(e)}\n` +
        `stdout (first 500 chars):\n${res.stdout.slice(0, 500)}`
    );
  }
}
