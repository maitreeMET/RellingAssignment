// src/main/videoMetadata.ts
import fs from "node:fs";
import { runFfprobe } from "./ffprobe";

function parseFraction(fr: string | undefined | null): number | null {
  if (!fr) return null;
  const s = String(fr);
  const parts = s.split("/");
  if (parts.length !== 2) {
    const asNum = Number(s);
    return Number.isFinite(asNum) ? asNum : null;
  }
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const val = num / den;
  return Number.isFinite(val) && val > 0 ? val : null;
}

function parseDurationSeconds(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function computeAspectRatio(
  width: number | null,
  height: number | null,
  displayAspectRatio: string | null
): { aspect_ratio_str: string | null; aspect_ratio: number | null } {
  if (displayAspectRatio && displayAspectRatio !== "0:1" && displayAspectRatio !== "N/A") {
    const parts = displayAspectRatio.split(":");
    if (parts.length === 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
        return { aspect_ratio_str: displayAspectRatio, aspect_ratio: a / b };
      }
    }
  }

  if (width && height && height !== 0) {
    return { aspect_ratio_str: `${width}:${height}`, aspect_ratio: width / height };
  }

  return { aspect_ratio_str: null, aspect_ratio: null };
}

function extractRotationRaw(videoStream: any): string | null {
  // Common case: tags.rotate
  const rotateTag = videoStream?.tags?.rotate;
  if (rotateTag !== undefined && rotateTag !== null) return String(rotateTag);

  // Another common case: side_data_list contains an entry with rotation
  const sdl = videoStream?.side_data_list;
  if (Array.isArray(sdl)) {
    for (const entry of sdl) {
      // sometimes entry.rotation exists
      if (entry?.rotation !== undefined && entry?.rotation !== null) {
        return String(entry.rotation);
      }
      // sometimes Display Matrix has "rotation" key
      if (entry?.side_data_type?.toLowerCase?.().includes("display matrix")) {
        if (entry?.rotation !== undefined && entry?.rotation !== null) {
          return String(entry.rotation);
        }
      }
    }
  }

  return null;
}

export type ComputedVideoMetadata = {
  fps: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;
  aspect_ratio_str: string | null;
  rotation_raw: string | null;
  codec: string | null;
  codec_long_name: string | null;
  file_size_bytes: number | null;

  // optional extras (nice to keep)
  container_format: string | null;
  ffprobe_raw: any; // full raw JSON for debugging / inspectability
};

export async function extractVideoMetadata(filePath: string): Promise<ComputedVideoMetadata> {
  const raw = await runFfprobe(filePath);

  const streams = Array.isArray(raw.streams) ? raw.streams : [];
  const format = raw.format ?? {};

  // pick primary video stream
  const videoStream =
    streams.find((s) => s?.codec_type === "video" && s?.disposition?.default === 1) ??
    streams.find((s) => s?.codec_type === "video") ??
    null;

  if (!videoStream) {
    throw new Error("ffprobe returned no video stream.");
  }

  const width = Number.isFinite(Number(videoStream.width)) ? Number(videoStream.width) : null;
  const height = Number.isFinite(Number(videoStream.height)) ? Number(videoStream.height) : null;

  // fps: prefer r_frame_rate, fallback avg_frame_rate
  const fps =
    parseFraction(videoStream.r_frame_rate) ??
    parseFraction(videoStream.avg_frame_rate) ??
    null;

  const duration_seconds =
    parseDurationSeconds(format.duration) ??
    parseDurationSeconds(videoStream.duration) ??
    null;

  const displayAspectRatio =
    typeof videoStream.display_aspect_ratio === "string" ? videoStream.display_aspect_ratio : null;

  const { aspect_ratio, aspect_ratio_str } = computeAspectRatio(width, height, displayAspectRatio);

  const rotation_raw = extractRotationRaw(videoStream);

  const codec = typeof videoStream.codec_name === "string" ? videoStream.codec_name : null;
  const codec_long_name =
    typeof videoStream.codec_long_name === "string" ? videoStream.codec_long_name : null;

  // file size: prefer filesystem stat (most reliable)
  let file_size_bytes: number | null = null;
  try {
    const st = fs.statSync(filePath);
    file_size_bytes = Number.isFinite(st.size) ? st.size : null;
  } catch {
    const sizeFromProbe = Number(format.size);
    file_size_bytes = Number.isFinite(sizeFromProbe) ? sizeFromProbe : null;
  }

  const container_format =
    typeof format.format_name === "string" ? format.format_name : null;

  return {
    fps,
    duration_seconds,
    width,
    height,
    aspect_ratio,
    aspect_ratio_str,
    rotation_raw,
    codec,
    codec_long_name,
    file_size_bytes,
    container_format,
    ffprobe_raw: raw,
  };
}
