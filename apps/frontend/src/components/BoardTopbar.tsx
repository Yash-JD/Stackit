import { Bell, Menu, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router";

type BoardTopbarProps = {
  boardId?: string;
  boardTitle?: string;
  onMenuClick: () => void;
};

export function BoardTopbar({
  boardId,
  boardTitle,
  onMenuClick,
}: BoardTopbarProps) {
  const navigate = useNavigate();

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
        <button onClick={() => navigate(boardId ? `/board/${boardId}` : "/") }>
          Boards
        </button>
        <span>/</span>
        <strong>{boardTitle ?? "Board"}</strong>
      </div>
      <div className="topbar-actions">
        <div className="presence-stack">
          <span className="presence-avatar presence-one">A</span>
          <span className="presence-avatar presence-two">R</span>
          <span className="presence-avatar presence-three">M</span>
          <span className="presence-more">+5</span>
        </div>
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

export function BoardHeader({ title = "Board" }: { title?: string }) {
  return (
    <section className="board-header">
      <div>
        <div className="eyebrow">
          Product operations <span className="status-dot" /> Live workspace
        </div>
        <h1>{title}</h1>
        <p>Turn the next big idea into something people can use.</p>
      </div>
      <button className="share-button">
        <Users size={16} /> Share board
      </button>
    </section>
  );
}
