import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CircleHelp,
  ChevronDown,
  Home,
  LayoutGrid,
  Plus,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  createBoard,
  createOrganization,
  deleteOrganization,
  getBoards,
  getOrganizations,
  getProfile,
  updateOrganization,
  type UserProfile,
} from "../api";
import { StackitLogo } from "./StackitLogo";
import { OrganizationMembersDialog } from "./OrganizationMembersDialog";
import { getAvatarGradient } from "../colors";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  selectedOrgId: string;
  onSelectOrganization: (organizationId: string) => void;
  onToggleCollapse: () => void;
};

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  selectedOrgId,
  onSelectOrganization,
  onToggleCollapse,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const workspacePickerRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [organizations, setOrganizations] = useState<
    Awaited<ReturnType<typeof getOrganizations>>
  >([]);
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
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [createBoardError, setCreateBoardError] = useState("");
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
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
  const [showMembersDialog, setShowMembersDialog] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    const loadOrganizations = async () => {
      setIsLoadingOrganizations(true);
      setOrganizationsError("");

      try {
        const result = await getOrganizations();
        if (!isCurrent) return;

        setOrganizations(result);
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
    void getProfile()
      .then((profile) => {
        if (isCurrent) {
          setUserProfile(profile);
          setProfileError(false);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setProfileError(true);
          console.error("Unable to load the signed-in user's profile:", error);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const refreshProfile = () => {
      void getProfile()
        .then((profile) => {
          setUserProfile(profile);
          setProfileError(false);
        })
        .catch((error: unknown) => {
          setProfileError(true);
          console.error(
            "Unable to refresh the signed-in user's profile:",
            error,
          );
        });
    };
    window.addEventListener("stackit:profile-changed", refreshProfile);
    return () =>
      window.removeEventListener("stackit:profile-changed", refreshProfile);
  }, []);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !workspacePickerRef.current?.contains(event.target)
      ) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsWorkspaceMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isWorkspaceMenuOpen]);

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

  useEffect(() => {
    const refreshOrganizations = () =>
      setOrganizationsRetry((retry) => retry + 1);
    window.addEventListener(
      "stackit:organizations-changed",
      refreshOrganizations,
    );
    return () =>
      window.removeEventListener(
        "stackit:organizations-changed",
        refreshOrganizations,
      );
  }, []);

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrgId,
  );
  const canManageWorkspace =
    selectedOrganization?.membershipRole === "superadmin" ||
    selectedOrganization?.membershipRole === "admin";

  const handleCreateBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newBoardTitle.trim();
    if (!selectedOrgId || !title) return;

    setCreateBoardError("");
    setIsCreatingBoard(true);
    try {
      const board = await createBoard(selectedOrgId, title);
      setNewBoardTitle("");
      setShowCreateBoard(false);
      window.dispatchEvent(new Event("stackit:boards-changed"));
      onClose();
      navigate(`/board/${board.id}`);
    } catch (error) {
      setCreateBoardError(
        error instanceof Error ? error.message : "Unable to create this board.",
      );
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleCreateOrganization = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
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
      onSelectOrganization(newOrganization.id);
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
            ? {
                ...updatedOrganization,
                membershipRole: organization.membershipRole,
              }
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
      onSelectOrganization(remainingOrganizations[0]?.id ?? "");
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
      <div className="brand-row">
        <Link to="/" className="brand-mark" aria-label="Stackit Home">
          <StackitLogo className="stackit-logo" />
          <span>Stackit</span>
        </Link>
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span aria-hidden="true">{isCollapsed ? "||>" : "<||"}</span>
        </button>
      </div>
      <div className="workspace-switcher">
        <div
          className="workspace-avatar"
          style={{
            background: getAvatarGradient(selectedOrganization?.name ?? "Stackit"),
            color: "#ffffff",
          }}
        >
          {selectedOrganization?.name.charAt(0).toUpperCase() ?? "S"}
        </div>
        <div className="workspace-picker" ref={workspacePickerRef}>
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
              onClick={() => setIsWorkspaceMenuOpen((isOpen) => !isOpen)}
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
                    onSelectOrganization(organization.id);
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
          className={`nav-item ${location.pathname === "/" ? "active" : ""}`}
          type="button"
          onClick={() => {
            navigate("/");
            onClose();
          }}
          aria-label="Home"
          title={isCollapsed ? "Home" : undefined}
        >
          <Home size={17} /> <span>Home</span>
        </button>
        <button
          className={`nav-item ${location.pathname === "/boards" ? "active" : ""}`}
          type="button"
          onClick={() => {
            navigate("/boards");
            onClose();
          }}
          aria-label="Boards"
          title={isCollapsed ? "Boards" : undefined}
        >
          <LayoutGrid size={17} /> <span>Boards</span>
        </button>
        <button
          className={`nav-item ${location.pathname === "/members" ? "active" : ""}`}
          type="button"
          onClick={() => {
            navigate("/members");
            onClose();
          }}
          aria-label="Members"
          title={isCollapsed ? "Members" : undefined}
        >
          <Users size={17} /> <span>Members</span>
        </button>
        <button
          className={`nav-item ${location.pathname === "/settings" ? "active" : ""}`}
          type="button"
          onClick={() => {
            navigate("/settings");
            onClose();
          }}
          aria-label="Settings"
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings size={17} /> <span>Settings</span>
        </button>
        <p className="nav-label recent-label">Your boards</p>
        {isLoadingOrganizations || isLoadingBoards ? (
          <p className="sidebar-state" role="status">
            Loading boards...
          </p>
        ) : organizationsError ? (
          <div className="sidebar-state sidebar-state-error" role="alert">
            <span>{organizationsError}</span>
            <button onClick={() => setOrganizationsRetry((retry) => retry + 1)}>
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
              title={isCollapsed ? board.title : undefined}
              aria-label={board.title}
            >
              <span className={`recent-dot dot-${index % 3}`} />
              <span className="recent-board-title">{board.title}</span>
            </Link>
          ))
        )}
        {canManageWorkspace &&
          !isLoadingOrganizations &&
          !isLoadingBoards &&
          !organizationsError &&
          !boardsError &&
          selectedOrganization && (
            <button
              type="button"
              className="recent-board recent-board-add"
              aria-label="Add new board"
              title={isCollapsed ? "Add new board" : undefined}
              onClick={() => {
                setCreateBoardError("");
                setShowCreateBoard(true);
              }}
            >
              <span className="recent-board-title">Add new board</span>
              <Plus size={15} aria-hidden="true" />
            </button>
          )}
      </nav>
      {showMembersDialog && selectedOrganization && (
        <OrganizationMembersDialog
          organizationId={selectedOrganization.id}
          organizationName={selectedOrganization.name}
          canManage={canManageWorkspace}
          boards={boards}
          onClose={() => setShowMembersDialog(false)}
        />
      )}
      {showCreateBoard && canManageWorkspace && (
        <div
          className="modal-backdrop sidebar-modal-backdrop"
          onClick={() => !isCreatingBoard && setShowCreateBoard(false)}
        >
          <section
            className="sidebar-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-create-board-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3 id="sidebar-create-board-title">Create board</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCreateBoard(false)}
                disabled={isCreatingBoard}
                aria-label="Close create board dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateBoard} className="sidebar-form">
              <label>
                <span>Board name</span>
                <input
                  value={newBoardTitle}
                  onChange={(event) => setNewBoardTitle(event.target.value)}
                  placeholder="Product launch"
                  autoFocus
                  required
                  maxLength={120}
                />
              </label>
              {createBoardError && (
                <p className="form-error" role="alert">
                  {createBoardError}
                </p>
              )}
              <div className="sidebar-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateBoard(false)}
                  disabled={isCreatingBoard}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isCreatingBoard || !newBoardTitle.trim()}
                >
                  {isCreatingBoard ? "Creating..." : "Create board"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
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
                  onChange={(event) =>
                    setWorkspaceDescription(event.target.value)
                  }
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
          <CircleHelp size={17} /> <span>Help center</span>
        </button>
        <Link
          className="profile-row"
          to="/profile"
          onClick={onClose}
          aria-label="Open your profile"
        >
          <div className="profile-avatar">
            <UserRound size={15} />
          </div>
          <div>
            <strong>
              {userProfile?.name ??
                (profileError ? "Profile unavailable" : "Loading profile...")}
            </strong>
            <span>
              {userProfile?.email ??
                (profileError ? "Open account settings" : "Account settings")}
            </span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
