import { Bell, Check, Link2, Menu, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { BoardPresenceUser, BoardSocketStatus } from "../hooks/useBoard";

type BoardTopbarProps = {
  boardTitle?: string;
  onMenuClick: () => void;
  presenceUsers: BoardPresenceUser[];
  socketStatus: BoardSocketStatus;
  onRetrySocket: () => void;
};

export function BoardTopbar({
  boardTitle,
  onMenuClick,
  presenceUsers,
  socketStatus,
  onRetrySocket,
}: BoardTopbarProps) {
  const navigate = useNavigate();
  const statusLabels: Record<BoardSocketStatus, string> = {
    idle: "Offline",
    connecting: "Connecting",
    connected: "Live",
    reconnecting: "Reconnecting",
    unavailable: "Connection unavailable",
  };

  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
      >
        <Menu size={19} />
      </button>
      <div className="breadcrumbs">
        <button onClick={() => navigate("/")}>Boards</button>
        <span>/</span>
        <strong>{boardTitle ?? "Board"}</strong>
      </div>
      <div className="topbar-actions">
        <div className="presence-stack">
          {presenceUsers.slice(0, 3).map((user) => (
            <span
              className="presence-avatar"
              key={user.id}
              title={user.email}
              aria-label={user.email}
            >
              {user.profile ? (
                <img src={user.profile} alt="" />
              ) : (
                user.email.charAt(0).toUpperCase()
              )}
            </span>
          ))}
          {presenceUsers.length > 3 && (
            <span className="presence-more">+{presenceUsers.length - 3}</span>
          )}
        </div>
        <button
          className={`socket-status socket-status-${socketStatus}`}
          type="button"
          onClick={socketStatus === "unavailable" ? onRetrySocket : undefined}
          disabled={socketStatus !== "unavailable"}
          aria-live="polite"
          title={
            socketStatus === "unavailable"
              ? "Retry live board connection"
              : `Board connection: ${statusLabels[socketStatus]}`
          }
        >
          <span className="socket-status-dot" />
          {statusLabels[socketStatus]}
        </button>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="upgrade-button">
          Upgrade <Sparkles size={14} />
        </button>
      </div>
    </header>
  );
}

export function BoardHeader({
  title = "Board",
  boardId,
}: {
  title?: string;
  boardId?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const url = boardId
        ? `${window.location.origin}/board/${boardId}`
        : window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy board link:", err);
    }
  };

  return (
    <section className="board-header">
      <div>
        <div className="eyebrow">
          Product operations <span className="status-dot" /> Board workspace
        </div>
        <h1>{title}</h1>
        <p>Turn the next big idea into something people can use.</p>
      </div>
      <div className="board-header-actions">
        <button
          type="button"
          className={`share-button ${copied ? "copied" : ""}`}
          onClick={handleShare}
          title={copied ? "Board link copied to clipboard!" : "Copy board link"}
        >
          {copied ? <Check size={16} /> : <Link2 size={16} />}
          <span>{copied ? "Link copied!" : "Share board"}</span>
        </button>
      </div>
    </section>
  );
}
