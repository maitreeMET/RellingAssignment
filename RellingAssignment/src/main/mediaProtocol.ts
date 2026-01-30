import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { protocol, net } from "electron";
import { getVideo } from "./db/queries";
import { clipPath } from "./paths";

const BASE = path.resolve(process.cwd(), "data", "videos");

export function registerMediaProtocol() {
  console.log("[media] Registering media:// protocol handler");

  protocol.handle("media", (request) => {
    console.log("[media] Request:", request.url);
    try {
      const url = new URL(request.url);
      console.log("[media] hostname:", url.hostname, "pathname:", url.pathname);

      // media://video/<video_id>/original
      // media://video/<video_id>/clip/<index>
      if (url.hostname !== "video") {
        console.log("[media] Invalid host");
        return new Response("Invalid media host", { status: 400 });
      }

      const parts = url.pathname.split("/").filter(Boolean);
      const video_id = parts[0];
      const kind = parts[1];
      console.log("[media] video_id:", video_id, "kind:", kind);

      let filePath: string;

      if (kind === "original") {
        filePath = getVideo(video_id).original_path;
      } else if (kind === "clip") {
        const idx = Number(parts[2]);
        if (!Number.isFinite(idx) || idx < 0 || idx > 999) {
          return new Response("Bad clip index", { status: 400 });
        }
        filePath = clipPath(video_id, idx);
      } else {
        console.log("[media] Invalid kind");
        return new Response("Invalid media kind", { status: 400 });
      }

      const resolved = path.resolve(filePath);
      console.log("[media] Resolved path:", resolved);

      // Safety: only allow files under ./data/videos
      if (!resolved.startsWith(BASE)) {
        console.log("[media] Path escape blocked, BASE:", BASE);
        return new Response("Path escape blocked", { status: 403 });
      }
      if (!fs.existsSync(resolved)) {
        console.log("[media] File not found");
        return new Response("File not found", { status: 404 });
      }

      const fileUrl = pathToFileURL(resolved).toString();
      console.log("[media] Serving file:", fileUrl);

      // Use net.fetch to serve the file
      return net.fetch(fileUrl);
    } catch (e) {
      console.error("[media] protocol error:", e);
      return new Response("Internal error", { status: 500 });
    }
  });
}
