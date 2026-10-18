import { useEffect, useState } from "react";
import {
  CircleHelp,
  ChevronDown,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { getBoards, getOrganizations } from "../api";
import { useAuth } from "../auth";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();
  const [organizations, setOrganizations] = useState<
    Awaited<ReturnType<typeof getOrganizations>>
  >([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [boards, setBoards] = useState<Awaited<ReturnType<typeof getBoards>>>(
    [],
  );
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const [organizationsError, setOrganizationsError] = useState("");
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [boardsError, setBoardsError] = useState("");
  const [organizationsRetry, setOrganizationsRetry] = useState(0);
  const [boardsRetry, setBoardsRetry] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    const loadOrganizations = async () => {
      setIsLoadingOrganizations(true);
      setOrganizationsError("");

      try {
        const result = await getOrganizations();
        if (!isCurrent) return;

        setOrganizations(result);
        setSelectedOrgId((current) =>
          result.some((organization) => organization.id === current)
            ? current
            : (result[0]?.id ?? ""),
        );
      } catch (error) {
        if (!isCurrent) return;
        setOrganizationsError(
          error instanceof Error
            ? error.message
            : "Unable to load organizations",
        );
      } finally {
        if (isCurrent) setIsLoadingOrganizations(false);
      }
    };

    void loadOrganizations();

    return () => {
      isCurrent = false;
    };
  }, [organizationsRetry]);

  useEffect(() => {
    let isCurrent = true;

    if (!selectedOrgId) {
      setBoards([]);
      setIsLoadingBoards(false);
      setBoardsError("");
      return () => {
        isCurrent = false;
      };
    }

    const loadBoards = async () => {
      setIsLoadingBoards(true);
      setBoardsError("");

      try {
        const result = await getBoards(selectedOrgId);
        if (isCurrent) setBoards(result);
      } catch (error) {
        if (!isCurrent) return;
        setBoardsError(
          error instanceof Error ? error.message : "Unable to load boards",
        );
      } finally {
        if (isCurrent) setIsLoadingBoards(false);
      }
    };

    void loadBoards();

    return () => {
      isCurrent = false;
    };
  }, [selectedOrgId, boardsRetry]);

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrgId,
  );

  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="brand-mark">
        <Sparkles size={17} /> <span>stackit</span>
      </div>
      <div className="workspace-switcher">
        <div className="workspace-avatar">
          {selectedOrganization?.name.charAt(0).toUpperCase() ?? "S"}
        </div>
        <div className="workspace-picker">
          {isLoadingOrganizations ? (
            <span>Loading workspaces...</span>
          ) : organizationsError ? (
            <span>Workspaces unavailable</span>
          ) : organizations.length === 0 ? (
            <>
              <strong>No workspace</strong>
              <span>You're not in an organization</span>
            </>
          ) : (
            <select
              aria-label="Select workspace"
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          )}
          {organizations.length > 0 && <ChevronDown size={15} />}
        </div>
      </div>
      <nav className="sidebar-nav">
        <p className="nav-label">Workspace</p>
        <button className="nav-item active">
          <LayoutGrid size={17} /> Boards{" "}
          <span className="nav-count">{boards.length}</span>
        </button>
        <button className="nav-item">
          <Users size={17} /> Members <span className="nav-count">8</span>
        </button>
        <button className="nav-item">
          <Settings size={17} /> Settings
        </button>
        <p className="nav-label recent-label">Recent boards</p>
        {isLoadingOrganizations || isLoadingBoards ? (
          <p className="sidebar-state" role="status">
            Loading boards...
          </p>
        ) : organizationsError ? (
          <div className="sidebar-state sidebar-state-error" role="alert">
            <span>{organizationsError}</span>
            <button
              onClick={() => setOrganizationsRetry((retry) => retry + 1)}
            >
              Retry
            </button>
          </div>
        ) : boardsError ? (
          <div className="sidebar-state sidebar-state-error" role="alert">
            <span>{boardsError}</span>
            <button onClick={() => setBoardsRetry((retry) => retry + 1)}>
              Retry
            </button>
          </div>
        ) : organizations.length === 0 ? (
          <p className="sidebar-state">
            Join or create a workspace to see boards.
          </p>
        ) : boards.length === 0 ? (
          <p className="sidebar-state">No boards in this workspace yet.</p>
        ) : (
          boards.map((board, index) => (
            <Link
              className="recent-board"
              key={board.id}
              to={`/board/${board.id}`}
              onClick={onClose}
            >
              <span className={`recent-dot dot-${index % 3}`} />
              {board.title}
            </Link>
          ))
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
