import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

type ComputedMeta = {
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
  container_format: string | null;
};

type ClipJobState = "NotStarted" | "Generating" | "Done" | "Failed";

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

function fmt(n: number | null, digits = 2) {
  if (n === null) return "—";
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Status badge component
function StatusBadge({ status }: { status: VideoStatus }) {
  const colors = {
    Approved: { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e", text: "#22c55e" },
    Rejected: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#ef4444" },
    Pending: { bg: "rgba(251, 191, 36, 0.15)", border: "#fbbf24", text: "#fbbf24" },
  };
  const c = colors[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 500,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      {status}
    </span>
  );
}

// Clip job status component
function ClipJobStatus({ state }: { state: ClipJobState | null }) {
  const stateConfig = {
    NotStarted: { color: "#9ca3af", label: "Not Started" },
    Generating: { color: "#3b82f6", label: "Generating..." },
    Done: { color: "#22c55e", label: "Complete" },
    Failed: { color: "#ef4444", label: "Failed" },
  };
  const config = state ? stateConfig[state] : stateConfig.NotStarted;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: config.color,
          animation: state === "Generating" ? "pulse 1.5s infinite" : undefined,
        }}
      />
      <span style={{ color: config.color, fontWeight: 500 }}>{config.label}</span>
    </span>
  );
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
  variant?: "default" | "primary" | "success" | "danger" | "ghost";
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
    success: { background: "#22c55e", color: "#fff" },
    danger: { background: "#dc2626", color: "#fff" },
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
        padding: "10px 0",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#e5e5e5", fontSize: 13, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function QaView() {
  const { video_id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState<VideoRow | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipJob, setClipJob] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [rescanStatus, setRescanStatus] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null });

  const meta: ComputedMeta | null = useMemo(() => {
    if (!video?.metadata_json) return null;
    try {
      return JSON.parse(video.metadata_json) as any;
    } catch {
      return null;
    }
  }, [video?.metadata_json]);

  async function refresh() {
    if (!video_id) return;
    const v = await window.api.getVideo(video_id);
    setVideo(v);
    const url = await window.api.getOriginalUrl(video_id);
    setVideoUrl(url);
    const job = await window.api.getClipJob(video_id);
    setClipJob(job);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, [video_id]);

  async function setStatus(status: VideoStatus) {
    if (!video_id) return;
    setBusy(true);
    setError(null);
    try {
      await window.api.setVideoStatus(video_id, status);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

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
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>QA Review</h1>
          <p style={{ margin: "6px 0 0", color: "#888", fontSize: 14 }}>
            Review video quality and approve for processing
          </p>
        </div>
        <Button onClick={() => navigate("/")} variant="ghost">
          ← Back to Dashboard
        </Button>
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

      {!video ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 400,
            color: "#888",
          }}
        >
          Loading...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          {/* Left Column - Video Player */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Video Card */}
            <div
              style={{
                background: "#1e1e1e",
                borderRadius: 12,
                border: "1px solid #333",
                overflow: "hidden",
              }}
            >
              {/* Video Header */}
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
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#f5f5f5",
                      maxWidth: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={video.filename}
                  >
                    {video.filename}
                  </h2>
                </div>
                <StatusBadge status={video.status} />
              </div>

              {/* Video Player */}
              <div style={{ background: "#000" }}>
                {videoUrl ? (
                  <video
                    controls
                    src={videoUrl}
                    style={{
                      width: "100%",
                      maxHeight: 480,
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 400,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#666",
                    }}
                  >
                    Loading video...
                  </div>
                )}
              </div>

              {/* Video Actions */}
              <div style={{ padding: "16px 20px", borderTop: "1px solid #333" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button
                    onClick={() => setStatus("Approved")}
                    disabled={busy || video.status === "Approved"}
                    variant="success"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => setStatus("Rejected")}
                    disabled={busy || video.status === "Rejected"}
                    variant="danger"
                  >
                    Reject
                  </Button>
                  <Button onClick={() => refresh()} disabled={busy} variant="ghost">
                    Refresh
                  </Button>
                  {video.status === "Approved" && (
                    <Button onClick={() => navigate(`/videos/${video_id}/clips`)} variant="primary">
                      View Clips
                    </Button>
                  )}
                </div>
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "#666" }}>
                  Approving will automatically generate 2-minute clips from this video.
                </p>
              </div>
            </div>

            {/* Clip Generation Status */}
            <div
              style={{
                background: "#1e1e1e",
                borderRadius: 12,
                border: "1px solid #333",
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Clip Generation</h3>
                <ClipJobStatus state={clipJob?.state ?? null} />
              </div>

              {clipJob?.state === "Failed" && (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 4 }}>
                    FFmpeg error (exit code: {clipJob.last_exit_code ?? "unknown"})
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#888",
                      fontFamily: "monospace",
                      maxHeight: 100,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {(clipJob.last_stderr ?? "").slice(0, 500)}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {video.status === "Approved" && clipJob?.state !== "Generating" && clipJob?.state !== "Done" && (
                  <Button
                    onClick={async () => {
                      await window.api.generateClips(video_id);
                      await refresh();
                    }}
                    size="small"
                  >
                    Generate Clips
                  </Button>
                )}
                {clipJob?.state === "Done" && (
                  <Button
                    onClick={async () => {
                      setRescanStatus({ loading: true, message: null });
                      try {
                        const result = await window.api.backfillClipMetadata(video_id);
                        setRescanStatus({ loading: false, message: `Scanned ${result.scanned} clips, updated ${result.upserted}` });
                        await refresh();
                        // Clear message after 3 seconds
                        setTimeout(() => setRescanStatus({ loading: false, message: null }), 3000);
                      } catch (e: any) {
                        setRescanStatus({ loading: false, message: null });
                        setError(e?.message ?? String(e));
                      }
                    }}
                    size="small"
                    variant="ghost"
                    disabled={rescanStatus.loading}
                  >
                    {rescanStatus.loading ? "Scanning..." : "Re-scan Metadata"}
                  </Button>
                )}
                {rescanStatus.message && (
                  <span style={{ fontSize: 12, color: "#22c55e" }}>
                    {rescanStatus.message}
                  </span>
                )}
              </div>
            </div>

            {/* Debug Tools (Collapsible) */}
            <div
              style={{
                background: "#1e1e1e",
                borderRadius: 12,
                border: "1px solid #333",
                overflow: "hidden",
              }}
            >
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
                  color: "#888",
                  fontSize: 13,
                }}
              >
                <span>Debug Tools</span>
                <span style={{ transform: showDebug ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  ▼
                </span>
              </button>
              {showDebug && (
                <div style={{ padding: "0 20px 16px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button onClick={() => window.api.revealVideoDir(video_id)} size="small" variant="ghost">
                    Open Video Folder
                  </Button>
                  <Button onClick={() => window.api.revealClipsDir(video_id)} size="small" variant="ghost">
                    Open Clips Folder
                  </Button>
                  {video.error_message && (
                    <Button
                      onClick={() => navigator.clipboard.writeText(video.error_message!)}
                      size="small"
                      variant="ghost"
                    >
                      Copy Error
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div
            style={{
              background: "#1e1e1e",
              borderRadius: 12,
              border: "1px solid #333",
              padding: 20,
              height: "fit-content",
              position: "sticky",
              top: 32,
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Video Metadata</h3>

            {!meta ? (
              <div style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>
                Metadata not yet extracted. It should be automatically extracted after upload.
              </div>
            ) : (
              <div>
                <MetaRow label="Duration" value={formatDuration(meta.duration_seconds)} />
                <MetaRow label="Resolution" value={`${meta.width ?? "—"} × ${meta.height ?? "—"}`} />
                <MetaRow label="Frame Rate" value={`${fmt(meta.fps, 2)} fps`} />
                <MetaRow label="Aspect Ratio" value={meta.aspect_ratio_str ?? "—"} />
                <MetaRow label="File Size" value={bytesToHuman(meta.file_size_bytes)} />
                <MetaRow label="Codec" value={meta.codec ?? "—"} />
                <MetaRow label="Container" value={meta.container_format ?? "—"} />
                <MetaRow label="Rotation" value={meta.rotation_raw ?? video.rotation_raw ?? "None"} />
              </div>
            )}

            {video.error_message && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 4, fontWeight: 500 }}>
                  Metadata Error
                </div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>{video.error_message}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pulse animation for generating state */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
