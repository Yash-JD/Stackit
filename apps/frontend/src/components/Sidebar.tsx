import {
  CircleHelp,
  ChevronDown,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "../auth";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();
  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="brand-mark">
        <Sparkles size={17} /> <span>stackit</span>
      </div>
      <div className="workspace-switcher">
        <div className="workspace-avatar">S</div>
        <div>
          <strong>Stackit studio</strong>
          <span>Personal workspace</span>
        </div>
        <ChevronDown size={15} />
      </div>
      <nav className="sidebar-nav">
        <p className="nav-label">Workspace</p>
        <button className="nav-item active">
          <LayoutGrid size={17} /> Boards <span className="nav-count">4</span>
        </button>
        <button className="nav-item">
          <Users size={17} /> Members <span className="nav-count">8</span>
        </button>
        <button className="nav-item">
          <Settings size={17} /> Settings
        </button>
        <p className="nav-label recent-label">Recent boards</p>
        {["Product launch", "Mobile experience", "Stackit roadmap"].map(
          (name, index) => (
            <button className="recent-board" key={name} onClick={onClose}>
              <span className={`recent-dot dot-${index}`} />
              {name}
            </button>
          ),
        )}
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item">
          <CircleHelp size={17} /> Help center
        </button>
        <button className="profile-row" onClick={logout}>
          <div className="profile-avatar">Y</div>
          <div>
            <strong>Yash</strong>
            <span>Log out</span>
          </div>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}
