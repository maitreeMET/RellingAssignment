import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type VideoStatus = "Pending" | "Approved" | "Rejected";
type FilterStatus = "All" | VideoStatus;
type SortOrder = "newest" | "oldest";

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

// Styled status badge component
function StatusBadge({ status }: { status: VideoStatus }) {
  const colors = {
    Approved: { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e", text: "#22c55e" },
    Rejected: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#ef4444" },
    Pending: { bg: "rgba(156, 163, 175, 0.15)", border: "#9ca3af", text: "#9ca3af" },
  };
  const c = colors[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 12,
        fontSize: 12,
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

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Cleaner meta status indicator
function MetaStatus({ video }: { video: VideoRow }) {
  if (video.error_message) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 13 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
        Failed
      </span>
    );
  }
  if (video.metadata_json) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#22c55e", fontSize: 13 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
        Ready
      </span>
    );
  }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af" }} />
      Pending
    </span>
  );
}

// Button component for consistent styling
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
  variant?: "default" | "primary" | "danger" | "ghost";
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
    default: {
      background: "#3a3a3a",
      color: "#e5e5e5",
    },
    primary: {
      background: "#3b82f6",
      color: "#fff",
    },
    danger: {
      background: "#dc2626",
      color: "#fff",
    },
    ghost: {
      background: "transparent",
      color: "#9ca3af",
      border: "1px solid #444",
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variants[variant] }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.opacity = "0.85";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.opacity = "1";
        }
      }}
    >
      {children}
    </button>
  );
}

// Filter tab component
function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        background: active ? "#3b82f6" : "transparent",
        border: active ? "none" : "1px solid #444",
        borderRadius: 6,
        color: active ? "#fff" : "#888",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label}
      <span
        style={{
          background: active ? "rgba(255,255,255,0.2)" : "#333",
          padding: "2px 8px",
          borderRadius: 10,
          fontSize: 11,
        }}
      >
        {count}
      </span>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Compute filtered and sorted videos
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((v) => v.filename.toLowerCase().includes(query));
    }

    // Filter by status
    if (filterStatus !== "All") {
      result = result.filter((v) => v.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [videos, searchQuery, filterStatus, sortOrder]);

  // Count by status for filter tabs
  const statusCounts = useMemo(() => {
    return {
      All: videos.length,
      Pending: videos.filter((v) => v.status === "Pending").length,
      Approved: videos.filter((v) => v.status === "Approved").length,
      Rejected: videos.filter((v) => v.status === "Rejected").length,
    };
  }, [videos]);

  async function refresh() {
    const rows = await window.api.listVideos();
    setVideos(rows);
    setSelectedIds((prev) => {
      const existingIds = new Set(rows.map((v) => v.video_id));
      const filtered = new Set([...prev].filter((id) => existingIds.has(id)));
      return filtered.size !== prev.size ? filtered : prev;
    });
  }

  function toggleSelect(video_id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(video_id)) {
        next.delete(video_id);
      } else {
        next.add(video_id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const filteredIds = filteredVideos.map((v) => v.video_id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelectedIds(new Set());
  }

  async function onDeleteSelected() {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} video(s)? This will permanently remove all clips and data.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await window.api.deleteVideos([...selectedIds]);
      setSelectedIds(new Set());
      setDeleteMode(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message ?? String(e)));
  }, []);

  async function onUpload() {
    setError(null);
    setBusy(true);
    try {
      const res = await window.api.importVideo();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.canceled) return;
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 32, fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>
          Video Dashboard
        </h1>
        <p style={{ margin: "8px 0 0", color: "#888", fontSize: 15 }}>
          Upload and manage your video files
        </p>
      </div>

      {/* Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "16px 20px",
          background: "#1e1e1e",
          borderRadius: 10,
          border: "1px solid #333",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <Button onClick={onUpload} disabled={busy || deleting || deleteMode} variant="primary">
            {busy ? "Uploading..." : "Upload MP4"}
          </Button>
          <Button onClick={() => refresh()} disabled={busy || deleting} variant="ghost">
            Refresh
          </Button>
        </div>

        {!deleteMode ? (
          <Button onClick={() => setDeleteMode(true)} disabled={videos.length === 0} variant="ghost">
            Delete Items
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#888", fontSize: 14 }}>
              {selectedIds.size === 0 ? "Select items to delete" : `${selectedIds.size} selected`}
            </span>
            <Button onClick={exitDeleteMode} disabled={deleting} variant="ghost">
              Cancel
            </Button>
            <Button
              onClick={onDeleteSelected}
              disabled={deleting || selectedIds.size === 0}
              variant="danger"
            >
              {deleting ? "Deleting..." : `Delete (${selectedIds.size})`}
            </Button>
          </div>
        )}
      </div>

      {/* Search, Filter, Sort Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 16,
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "0 0 280px" }}>
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px 10px 40px",
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#e5e5e5",
              fontSize: 14,
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#333")}
          />
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#666",
              fontSize: 16,
            }}
          >
            🔍
          </span>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          <FilterTab label="All" count={statusCounts.All} active={filterStatus === "All"} onClick={() => setFilterStatus("All")} />
          <FilterTab label="Pending" count={statusCounts.Pending} active={filterStatus === "Pending"} onClick={() => setFilterStatus("Pending")} />
          <FilterTab label="Approved" count={statusCounts.Approved} active={filterStatus === "Approved"} onClick={() => setFilterStatus("Approved")} />
          <FilterTab label="Rejected" count={statusCounts.Rejected} active={filterStatus === "Rejected"} onClick={() => setFilterStatus("Rejected")} />
        </div>

        {/* Sort */}
        <button
          onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "#1e1e1e",
            border: "1px solid #333",
            borderRadius: 6,
            color: "#888",
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <span>{sortOrder === "newest" ? "↓" : "↑"}</span>
          {sortOrder === "newest" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: 16,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: 10,
            marginBottom: 16,
            color: "#ef4444",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Videos Table Card */}
      <div
        style={{
          background: "#1e1e1e",
          borderRadius: 12,
          border: "1px solid #333",
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: deleteMode
              ? "48px 2fr 1fr 100px 90px 140px"
              : "2fr 1fr 100px 90px 140px",
            padding: "14px 20px",
            background: "#252525",
            borderBottom: "1px solid #333",
            gap: 16,
          }}
        >
          {deleteMode && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={filteredVideos.length > 0 && filteredVideos.every((v) => selectedIds.has(v.video_id))}
                onChange={toggleSelectAll}
                disabled={filteredVideos.length === 0}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
            </div>
          )}
          <div style={{ color: "#888", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Filename
          </div>
          <div style={{ color: "#888", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Created
          </div>
          <div style={{ color: "#888", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Status
          </div>
          <div style={{ color: "#888", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Meta
          </div>
          <div style={{ color: "#888", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Actions
          </div>
        </div>

        {/* Table Body */}
        {filteredVideos.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#666" }}>
            {videos.length === 0 ? (
              <>
                <p style={{ margin: 0, fontSize: 15 }}>No videos yet</p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>
                  Upload an MP4 file to get started
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 15 }}>No videos match your search</p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>
                  Try adjusting your search or filters
                </p>
              </>
            )}
          </div>
        ) : (
          filteredVideos.map((v) => (
            <div
              key={v.video_id}
              onMouseEnter={() => setHoveredRow(v.video_id)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: "grid",
                gridTemplateColumns: deleteMode
                  ? "48px 2fr 1fr 100px 90px 140px"
                  : "2fr 1fr 100px 90px 140px",
                padding: "16px 20px",
                borderBottom: "1px solid #2a2a2a",
                alignItems: "center",
                gap: 16,
                background: hoveredRow === v.video_id ? "#252525" : "transparent",
                transition: "background 0.15s ease",
              }}
            >
              {deleteMode && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(v.video_id)}
                    onChange={() => toggleSelect(v.video_id)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                </div>
              )}
              <div
                style={{
                  color: "#e5e5e5",
                  fontSize: 14,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={v.filename}
              >
                {v.filename}
              </div>
              <div style={{ color: "#888", fontSize: 13 }}>{formatTime(v.created_at)}</div>
              <div>
                <StatusBadge status={v.status} />
              </div>
              <div>
                <MetaStatus video={v} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  onClick={() => navigate(`/qa/${v.video_id}`)}
                  disabled={deleteMode}
                  size="small"
                >
                  QA
                </Button>
                {v.status === "Approved" && (
                  <Button
                    onClick={() => navigate(`/videos/${v.video_id}/clips`)}
                    disabled={deleteMode}
                    size="small"
                    variant="ghost"
                  >
                    Clips
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      {videos.length > 0 && (
        <div style={{ marginTop: 16, color: "#666", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <div>
            {filteredVideos.length === videos.length
              ? `${videos.length} video${videos.length !== 1 ? "s" : ""}`
              : `Showing ${filteredVideos.length} of ${videos.length} videos`}
          </div>
          <div>
            {statusCounts.Approved > 0 && <span>{statusCounts.Approved} approved</span>}
            {statusCounts.Pending > 0 && <span style={{ marginLeft: 16 }}>{statusCounts.Pending} pending</span>}
            {statusCounts.Rejected > 0 && <span style={{ marginLeft: 16 }}>{statusCounts.Rejected} rejected</span>}
          </div>
        </div>
      )}
    </div>
  );
}
