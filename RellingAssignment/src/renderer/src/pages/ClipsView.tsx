import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

// Utility functions
function bytesToHuman(n: number | null) {
  if (n === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = n;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function fmt(n: number | null, digits = 2) {
  if (n === null) return "—";
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

// Button component
function Button({
  children,
  onClick,
  disabled,
  variant = "default",
  size = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "ghost";
  size?: "default" | "small";
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 6,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s ease",
    border: "none",
    opacity: disabled ? 0.5 : 1,
    padding: size === "small" ? "6px 12px" : "8px 16px",
    fontSize: size === "small" ? 13 : 14,
  };

  const variants: Record<string, React.CSSProperties> = {
    default: { background: "#3a3a3a", color: "#e5e5e5" },
    primary: { background: "#3b82f6", color: "#fff" },
    ghost: { background: "transparent", color: "#9ca3af", border: "1px solid #444" },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variants[variant] }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.opacity = "1")}
    >
      {children}
    </button>
  );
}

// Metadata row component
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#e5e5e5", fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function ClipsView() {
  const { video_id } = useParams();
  const navigate = useNavigate();

  const [clips, setClips] = useState<ClipRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hoveredClip, setHoveredClip] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const selectedClip = useMemo(() => {
    if (clips.length === 0) return null;
    const found = clips.find((c) => c.clip_index === selectedIndex);
    return found ?? clips[0];
  }, [clips, selectedIndex]);

  const totalDuration = useMemo(() => {
    return clips.reduce((sum, c) => sum + (c.duration ?? 0), 0);
  }, [clips]);

  const totalSize = useMemo(() => {
    return clips.reduce((sum, c) => sum + (c.file_size_bytes ?? 0), 0);
  }, [clips]);

  async function refresh() {
    if (!video_id) return;
    setError(null);
    const rows = await window.api.listClips(video_id);
    setClips(rows);

    if (rows.length > 0) {
      const keep = rows.find((r) => r.clip_index === selectedIndex) ? selectedIndex : rows[0].clip_index;
      setSelectedIndex(keep);
    } else {
      setSelectedUrl(null);
    }
  }

  async function loadClipUrl(clip: ClipRow) {
    setBusy(true);
    setError(null);
    try {
      const url = await window.api.getClipUrl(clip.video_id, clip.clip_index);
      setSelectedUrl(url);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, [video_id]);

  useEffect(() => {
    if (!selectedClip) return;
    loadClipUrl(selectedClip);
  }, [selectedClip?.clip_id]);

  if (!video_id) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <p style={{ color: "#888" }}>Missing video ID.</p>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 32,
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 1400,
        margin: "0 auto",
        height: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Video Clips</h1>
          <p style={{ margin: "6px 0 0", color: "#888", fontSize: 14 }}>
            {clips.length > 0
              ? `${clips.length} clips · ${formatDuration(totalDuration)} total · ${bytesToHuman(totalSize)}`
              : "Browse and preview generated clips"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Button onClick={() => navigate(`/qa/${video_id}`)} variant="ghost">
            ← Back to QA
          </Button>
          <Button onClick={() => navigate("/")} variant="ghost">
            Dashboard
          </Button>
          <Button onClick={() => refresh()} disabled={busy}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: 16,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: 10,
            marginBottom: 24,
            color: "#ef4444",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, flex: 1, minHeight: 0 }}>
        {/* Left: Clip List */}
        <div
          style={{
            background: "#1e1e1e",
            borderRadius: 12,
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* List Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #333",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Clips</h3>
            <span style={{ fontSize: 12, color: "#888" }}>{clips.length} total</span>
          </div>

          {/* List Body */}
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {clips.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
                <p style={{ margin: 0, fontSize: 14 }}>No clips found</p>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#555" }}>
                  Make sure the video is approved and clip generation is complete
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {clips.map((c) => {
                  const selected = c.clip_index === selectedIndex;
                  const hovered = c.clip_index === hoveredClip;
                  return (
                    <div
                      key={c.clip_id}
                      onClick={() => setSelectedIndex(c.clip_index)}
                      onMouseEnter={() => setHoveredClip(c.clip_index)}
                      onMouseLeave={() => setHoveredClip(null)}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        border: selected ? "2px solid #3b82f6" : "1px solid transparent",
                        background: selected ? "rgba(59, 130, 246, 0.1)" : hovered ? "#252525" : "transparent",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: selected ? "#3b82f6" : "#e5e5e5" }}>
                          Clip {c.clip_index + 1}
                        </span>
                        <span style={{ fontSize: 12, color: "#888" }}>{formatDuration(c.duration)}</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                        {c.width ?? "—"}×{c.height ?? "—"} · {bytesToHuman(c.file_size_bytes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Debug Tools */}
          <div style={{ borderTop: "1px solid #333" }}>
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "transparent",
                border: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                color: "#666",
                fontSize: 12,
              }}
            >
              <span>Debug Tools</span>
              <span style={{ transform: showDebug ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                ▼
              </span>
            </button>
            {showDebug && (
              <div style={{ padding: "0 12px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => window.api.revealClipsDir(video_id!)} size="small" variant="ghost">
                  Open Clips Folder
                </Button>
                <Button onClick={() => window.api.revealVideoDir(video_id!)} size="small" variant="ghost">
                  Open Video Folder
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Player */}
        <div
          style={{
            background: "#1e1e1e",
            borderRadius: 12,
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {!selectedClip ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
              }}
            >
              Select a clip to preview
            </div>
          ) : (
            <>
              {/* Player Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #333",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>
                    Clip {selectedClip.clip_index + 1}
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#888" }}>
                  <span>{formatDuration(selectedClip.duration)}</span>
                  <span>{selectedClip.width}×{selectedClip.height}</span>
                  <span>{bytesToHuman(selectedClip.file_size_bytes)}</span>
                </div>
              </div>

              {/* Video Player */}
              <div style={{ flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selectedUrl ? (
                  <video
                    key={selectedUrl}
                    controls
                    autoPlay
                    src={selectedUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      maxHeight: "calc(100vh - 400px)",
                      objectFit: "contain",
                      opacity: busy ? 0.7 : 1,
                    }}
                  />
                ) : (
                  <div style={{ color: "#666" }}>Loading clip...</div>
                )}
              </div>

              {/* Clip Metadata */}
              <div style={{ padding: 20, borderTop: "1px solid #333" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Clip Details
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
                  <MetaRow label="Duration" value={`${fmt(selectedClip.duration, 2)}s`} />
                  <MetaRow label="Frame Rate" value={`${fmt(selectedClip.fps, 2)} fps`} />
                  <MetaRow label="Resolution" value={`${selectedClip.width ?? "—"} × ${selectedClip.height ?? "—"}`} />
                  <MetaRow label="File Size" value={bytesToHuman(selectedClip.file_size_bytes)} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
