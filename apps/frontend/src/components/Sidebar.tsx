import { useEffect, useState, type FormEvent } from "react";
import {
  CircleHelp,
  ChevronDown,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  createOrganization,
  deleteOrganization,
  getBoards,
  getOrganizations,
  updateOrganization,
} from "../api";
import { useAuth } from "../auth";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<
    Awaited<ReturnType<typeof getOrganizations>>
  >([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [boards, setBoards] = useState<Awaited<ReturnType<typeof getBoards>>>(
    [],
  );
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const [organizationsError, setOrganizationsError] = useState("");
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [boardsError, setBoardsError] = useState("");
  const [organizationsRetry, setOrganizationsRetry] = useState(0);
  const [boardsRetry, setBoardsRetry] = useState(0);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState(
    "Workspace for our team",
  );
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [createOrganizationError, setCreateOrganizationError] = useState("");
  const [showOrganizationSettings, setShowOrganizationSettings] =
    useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationDescription, setOrganizationDescription] = useState("");
  const [organizationSettingsError, setOrganizationSettingsError] =
    useState("");
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const [confirmOrganizationDelete, setConfirmOrganizationDelete] =
    useState(false);

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

  useEffect(() => {
    const refreshBoards = () => setBoardsRetry((retry) => retry + 1);
    window.addEventListener("stackit:boards-changed", refreshBoards);
    return () =>
      window.removeEventListener("stackit:boards-changed", refreshBoards);
  }, []);

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrgId,
  );

  const handleCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) return;

    setCreateOrganizationError("");
    setIsCreatingOrganization(true);
    try {
      const newOrganization = await createOrganization(
        name,
        workspaceDescription.trim() || "Workspace for our team",
      );

      setOrganizations((current) => [newOrganization, ...current]);
      setSelectedOrgId(newOrganization.id);
      setOrganizationsError("");
      setWorkspaceName("");
      setWorkspaceDescription("Workspace for our team");
      setShowWorkspaceModal(false);
      window.dispatchEvent(new Event("stackit:organizations-changed"));
    } catch (error) {
      setCreateOrganizationError(
        error instanceof Error
          ? error.message
          : "Unable to create this workspace.",
      );
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const openOrganizationSettings = () => {
    if (!selectedOrganization) return;
    setOrganizationName(selectedOrganization.name);
    setOrganizationDescription(selectedOrganization.description);
    setOrganizationSettingsError("");
    setConfirmOrganizationDelete(false);
    setShowOrganizationSettings(true);
  };

  const handleUpdateOrganization = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!selectedOrganization) return;

    const name = organizationName.trim();
    if (!name) {
      setOrganizationSettingsError("Workspace name is required.");
      return;
    }

    setOrganizationSettingsError("");
    setIsSavingOrganization(true);
    try {
      const updatedOrganization = await updateOrganization(
        selectedOrganization.id,
        name,
        organizationDescription.trim(),
      );
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === updatedOrganization.id
            ? updatedOrganization
            : organization,
        ),
      );
      setShowOrganizationSettings(false);
      window.dispatchEvent(new Event("stackit:organizations-changed"));
    } catch (error) {
      setOrganizationSettingsError(
        error instanceof Error
          ? error.message
          : "Unable to update this workspace.",
      );
    } finally {
      setIsSavingOrganization(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) return;

    setOrganizationSettingsError("");
    setIsDeletingOrganization(true);
    try {
      await deleteOrganization(selectedOrganization.id);
      const remainingOrganizations = organizations.filter(
        (organization) => organization.id !== selectedOrganization.id,
      );
      setOrganizations(remainingOrganizations);
      setSelectedOrgId(remainingOrganizations[0]?.id ?? "");
      setShowOrganizationSettings(false);
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      navigate("/", { replace: true });
    } catch (error) {
      setOrganizationSettingsError(
        error instanceof Error
          ? error.message
          : "Unable to delete this workspace.",
      );
    } finally {
      setIsDeletingOrganization(false);
    }
  };

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
            <span className="workspace-name">No workspace</span>
          ) : (
            <span className="workspace-name" title={selectedOrganization?.name}>
              {selectedOrganization?.name}
            </span>
          )}
          {organizations.length > 0 && (
            <button
              type="button"
              className="workspace-menu-trigger"
              aria-label="Choose workspace"
              aria-haspopup="listbox"
              aria-expanded={isWorkspaceMenuOpen}
              onClick={() =>
                setIsWorkspaceMenuOpen((isOpen) => !isOpen)
              }
            >
              <ChevronDown size={15} />
            </button>
          )}
          {isWorkspaceMenuOpen && organizations.length > 0 && (
            <div
              className="workspace-menu"
              role="listbox"
              aria-label="Workspaces"
            >
              {organizations.map((organization) => (
                <button
                  type="button"
                  className={`workspace-menu-option ${
                    organization.id === selectedOrgId ? "selected" : ""
                  }`}
                  key={organization.id}
                  role="option"
                  aria-selected={organization.id === selectedOrgId}
                  onClick={() => {
                    setSelectedOrgId(organization.id);
                    setIsWorkspaceMenuOpen(false);
                  }}
                >
                  <span className="workspace-avatar">
                    {organization.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{organization.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <nav className="sidebar-nav">
        <p className="nav-label">Workspace</p>
        <button
          className="nav-item active"
          type="button"
          onClick={() => navigate("/")}
        >
          <LayoutGrid size={17} /> Boards
        </button>
        <button className="nav-item">
          <Users size={17} /> Members <span className="nav-count">8</span>
        </button>
        <button
          className="nav-item"
          type="button"
          onClick={openOrganizationSettings}
          disabled={!selectedOrganization}
        >
          <Settings size={17} /> Settings
        </button>
        <p className="nav-label recent-label">Your boards</p>
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
        ) : organizations.length === 0 ? (
          <div className="sidebar-state sidebar-state-empty">
            <span>Join or create a workspace to see boards.</span>
            <button
              type="button"
              onClick={() => {
                setCreateOrganizationError("");
                setShowWorkspaceModal(true);
              }}
            >
              Create workspace
            </button>
          </div>
        ) : boardsError ? (
          <div className="sidebar-state sidebar-state-error" role="alert">
            <span>{boardsError}</span>
            <button onClick={() => setBoardsRetry((retry) => retry + 1)}>
              Retry
            </button>
          </div>
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
      {showWorkspaceModal && (
        <div
          className="modal-backdrop sidebar-modal-backdrop"
          onClick={() => setShowWorkspaceModal(false)}
        >
          <div
            className="sidebar-form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3>Create workspace</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowWorkspaceModal(false)}
                aria-label="Close workspace form"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateOrganization} className="sidebar-form">
              <label>
                <span>Workspace name</span>
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Engineering team"
                  autoFocus
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={workspaceDescription}
                  onChange={(event) => setWorkspaceDescription(event.target.value)}
                  placeholder="Workspace for our team"
                />
              </label>
              {createOrganizationError && (
                <p className="form-error" role="alert">
                  {createOrganizationError}
                </p>
              )}
              <div className="sidebar-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowWorkspaceModal(false)}
                  disabled={isCreatingOrganization}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isCreatingOrganization || !workspaceName.trim()}
                >
                  {isCreatingOrganization ? "Creating..." : "Create workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrganizationSettings && selectedOrganization && (
        <div
          className="modal-backdrop sidebar-modal-backdrop"
          onClick={() => setShowOrganizationSettings(false)}
        >
          <div
            className="sidebar-form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3>Workspace settings</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowOrganizationSettings(false)}
                aria-label="Close workspace settings"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateOrganization} className="sidebar-form">
              <label>
                <span>Workspace name</span>
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={organizationDescription}
                  onChange={(event) =>
                    setOrganizationDescription(event.target.value)
                  }
                />
              </label>
              {organizationSettingsError && (
                <p className="form-error" role="alert">
                  {organizationSettingsError}
                </p>
              )}
              <div className="sidebar-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowOrganizationSettings(false)}
                  disabled={isSavingOrganization || isDeletingOrganization}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSavingOrganization || !organizationName.trim()}
                >
                  {isSavingOrganization ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
            <section className="danger-zone">
              <div>
                <h4>Delete workspace</h4>
                <p>
                  Delete this workspace and remove it from your workspace list.
                  This action cannot be undone.
                </p>
              </div>
              {confirmOrganizationDelete ? (
                <div className="danger-zone-confirm">
                  <span>Are you sure you want to delete this workspace?</span>
                  <div className="sidebar-form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setConfirmOrganizationDelete(false)}
                      disabled={isDeletingOrganization}
                    >
                      Keep workspace
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleDeleteOrganization()}
                      disabled={isDeletingOrganization}
                    >
                      {isDeletingOrganization ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => setConfirmOrganizationDelete(true)}
                >
                  Delete workspace
                </button>
              )}
            </section>
          </div>
        </div>
      )}

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
