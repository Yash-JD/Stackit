import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  LayoutGrid,
  Plus,
  RefreshCw,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useOutletContext } from "react-router";
import { ProjectHeader } from "../components/ProjectHeader";
import { CreateBoardDialog } from "../components/CreateBoardDialog";
import { OrganizationMembersDialog } from "../components/OrganizationMembersDialog";
import {
  deleteOrganization,
  getOrganizationActivity,
  updateOrganization,
  type IssueActivity,
} from "../api";
import type { WorkspaceLayoutContext } from "../types";

function formatHomeActivity(activity: IssueActivity) {
  const cardTitle = activity.issue?.title ? `"${activity.issue.title}"` : "a card";
  switch (activity.action) {
    case "created":
      return `created ${cardTitle}`;
    case "updated":
      return `updated ${cardTitle} (${activity.details ?? "details"})`;
    case "moved":
      return `moved ${cardTitle} ${activity.details ?? "to another list"}`;
    case "commented":
      return `commented on ${cardTitle}`;
    case "comment_edited":
      return `edited comment on ${cardTitle}`;
    case "comment_deleted":
      return `deleted comment on ${cardTitle}`;
    default:
      return `${activity.action} ${cardTitle}`;
  }
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function WorkspaceHome() {
  const {
    workspaces,
    selectedOrgId,
    onSelectOrganization,
    isLoading,
    error,
    refresh,
  } = useOutletContext<WorkspaceLayoutContext>();

  const selectedWorkspace =
    workspaces.find(({ organization }) => organization.id === selectedOrgId) ??
    workspaces[0];
  const visibleWorkspaces = selectedWorkspace ? [selectedWorkspace] : [];
  const visibleBoardCount = selectedWorkspace?.boards.length ?? 0;
  const canManageWorkspace =
    selectedWorkspace?.organization.membershipRole === "superadmin" ||
    selectedWorkspace?.organization.membershipRole === "admin";

  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [createBoardOrganizationId, setCreateBoardOrganizationId] = useState<string>();

  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState("");

  const loadActivity = useCallback(async () => {
    if (!selectedWorkspace?.organization.id) {
      setActivities([]);
      return;
    }
    setIsLoadingActivity(true);
    setActivityError("");
    try {
      const data = await getOrganizationActivity(selectedWorkspace.organization.id);
      setActivities(data);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Unable to load recent activity");
    } finally {
      setIsLoadingActivity(false);
    }
  }, [selectedWorkspace?.organization.id]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const handleActivityEvent = () => {
      void loadActivity();
    };
    window.addEventListener("stackit:issue-activity-changed", handleActivityEvent);
    window.addEventListener("stackit:boards-changed", handleActivityEvent);
    return () => {
      window.removeEventListener("stackit:issue-activity-changed", handleActivityEvent);
      window.removeEventListener("stackit:boards-changed", handleActivityEvent);
    };
  }, [loadActivity]);

  const handleSaveWorkspaceSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWorkspace || !canManageWorkspace) return;
    const name = settingsName.trim();
    if (!name) {
      setSettingsError("Workspace name is required.");
      return;
    }
    setSettingsError("");
    setIsSavingSettings(true);
    try {
      await updateOrganization(selectedWorkspace.organization.id, name, settingsDesc.trim());
      window.dispatchEvent(new Event("stackit:boards-changed"));
      await refresh();
      setShowWorkspaceSettings(false);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Unable to update workspace.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace || !canManageWorkspace) return;
    setIsDeletingOrg(true);
    setSettingsError("");
    try {
      await deleteOrganization(selectedWorkspace.organization.id);
      window.dispatchEvent(new Event("stackit:boards-changed"));
      await refresh();
      setShowWorkspaceSettings(false);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Unable to delete workspace.");
    } finally {
      setIsDeletingOrg(false);
    }
  };

  const openCreateBoard = (organizationId: string) => {
    setCreateBoardOrganizationId(organizationId);
    setShowCreateBoard(true);
  };

  return (
    <>
      <main className="board-shell workspace-home">
        {/* Section 1 – Project Hero */}
        <ProjectHeader
          name="Stackit"
          description="A Trello‑style project management tool — organize work into boards, lists, and cards with your team."
        />

        {/* Section 2 – My Organizations */}
        <section className="org-section">
          <h2 className="org-section-title">My Organizations</h2>
          {isLoading ? (
            <div className="org-section-loading" role="status">
              <span className="org-loading-dot" />
              <span className="org-loading-dot" />
              <span className="org-loading-dot" />
            </div>
          ) : error ? (
            <div className="org-section-error" role="alert">
              <p>{error}</p>
              <button className="secondary-button" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="org-empty">
              <div className="org-empty-icon">✨</div>
              <p>You’re not part of any organization yet.</p>
              <p className="org-empty-hint">Create one from the sidebar to get started.</p>
            </div>
          ) : (
            <div className="org-cards-grid">
              {workspaces.map(({ organization, boards }) => {
                const isSelected = organization.id === selectedOrgId;
                const roleBadge =
                  organization.membershipRole === "superadmin"
                    ? "Owner"
                    : organization.membershipRole === "admin"
                      ? "Admin"
                      : "Member";
                return (
                  <div
                    key={organization.id}
                    className={`org-card ${isSelected ? "org-card-selected" : ""}`}
                  >
                    <div className="org-card-top">
                      <div className="org-card-avatar">
                        {organization.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="org-card-role">{roleBadge}</span>
                    </div>
                    <div className="org-card-body">
                      <h3 className="org-card-name">{organization.name}</h3>
                      {organization.description && (
                        <p className="org-card-desc">{organization.description}</p>
                      )}
                      <p className="org-card-stats">
                        {boards.length} {boards.length === 1 ? "board" : "boards"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`org-card-enter ${isSelected ? "org-card-enter-active" : ""}`}
                      onClick={() => onSelectOrganization(organization.id)}
                      aria-label={`Enter ${organization.name}`}
                    >
                      {isSelected ? "Selected" : "Enter"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sections 3 & 4 – Quick Links & Recent Activity Dashboard Row */}
        {selectedWorkspace && (
          <div className="home-dashboard-row">
            {/* Section 3: Quick Links */}
            <section className="dashboard-widget quick-links-widget" aria-label="Quick Links">
              <div className="widget-header">
                <div>
                  <h2 className="widget-title">Quick Links</h2>
                  <p className="widget-subtitle">Workspace navigation & shortcuts</p>
                </div>
              </div>

              <div className="quick-links-list">
                <Link to="/boards" className="quick-link-card">
                  <div className="quick-link-icon icon-teal">
                    <LayoutGrid size={18} />
                  </div>
                  <div className="quick-link-info">
                    <span className="quick-link-name">Boards</span>
                    <span className="quick-link-desc">
                      {visibleBoardCount} {visibleBoardCount === 1 ? "board" : "boards"} in {selectedWorkspace.organization.name}
                    </span>
                  </div>
                  <span className="quick-link-badge">{visibleBoardCount}</span>
                  <ChevronRight size={16} className="quick-link-arrow" />
                </Link>

                <Link to="/members" className="quick-link-card">
                  <div className="quick-link-icon icon-indigo">
                    <Users size={18} />
                  </div>
                  <div className="quick-link-info">
                    <span className="quick-link-name">Members</span>
                    <span className="quick-link-desc">Manage team access & invites</span>
                  </div>
                  <span className="quick-link-badge">Manage</span>
                  <ChevronRight size={16} className="quick-link-arrow" />
                </Link>

                <Link to="/settings" className="quick-link-card">
                  <div className="quick-link-icon icon-amber">
                    <Settings size={18} />
                  </div>
                  <div className="quick-link-info">
                    <span className="quick-link-name">Workspace Settings</span>
                    <span className="quick-link-desc">
                      {canManageWorkspace ? "Edit workspace details & preferences" : "View workspace details"}
                    </span>
                  </div>
                  <span className="quick-link-badge">{canManageWorkspace ? "Admin" : "Info"}</span>
                  <ChevronRight size={16} className="quick-link-arrow" />
                </Link>

                <Link to="/profile" className="quick-link-card">
                  <div className="quick-link-icon icon-purple">
                    <UserRound size={18} />
                  </div>
                  <div className="quick-link-info">
                    <span className="quick-link-name">Profile & Account</span>
                    <span className="quick-link-desc">Manage display name & photo</span>
                  </div>
                  <ArrowUpRight size={16} className="quick-link-arrow" />
                </Link>
              </div>

              {canManageWorkspace && (
                <button
                  type="button"
                  className="quick-create-board-btn"
                  onClick={() => openCreateBoard(selectedWorkspace.organization.id)}
                >
                  <Plus size={16} />
                  <span>Create new board</span>
                </button>
              )}
            </section>

            {/* Section 4: Recent Activity */}
            <section className="dashboard-widget recent-activity-widget" aria-label="Recent Activity">
              <div className="widget-header">
                <div>
                  <h2 className="widget-title">Recent Activity</h2>
                  <p className="widget-subtitle">
                    Updates in {selectedWorkspace.organization.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button widget-refresh-btn"
                  onClick={() => void loadActivity()}
                  disabled={isLoadingActivity}
                  title="Refresh activity"
                  aria-label="Refresh activity"
                >
                  <RefreshCw size={14} className={isLoadingActivity ? "widget-spin" : ""} />
                </button>
              </div>

              <div className="activity-widget-body">
                {isLoadingActivity && activities.length === 0 ? (
                  <div className="activity-widget-loading">
                    <div className="activity-skeleton-item">
                      <span className="skeleton-avatar" />
                      <div className="skeleton-lines">
                        <span className="skeleton-line line-long" />
                        <span className="skeleton-line line-short" />
                      </div>
                    </div>
                    <div className="activity-skeleton-item">
                      <span className="skeleton-avatar" />
                      <div className="skeleton-lines">
                        <span className="skeleton-line line-long" />
                        <span className="skeleton-line line-short" />
                      </div>
                    </div>
                    <div className="activity-skeleton-item">
                      <span className="skeleton-avatar" />
                      <div className="skeleton-lines">
                        <span className="skeleton-line line-long" />
                        <span className="skeleton-line line-short" />
                      </div>
                    </div>
                  </div>
                ) : activityError ? (
                  <div className="activity-widget-error">
                    <p>{activityError}</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void loadActivity()}
                    >
                      Retry
                    </button>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="activity-widget-empty">
                    <div className="activity-empty-icon">
                      <Activity size={22} />
                    </div>
                    <p className="activity-empty-title">No recent activity</p>
                    <p className="activity-empty-desc">
                      When members create cards, update lists, or move tasks, updates will appear here in real time.
                    </p>
                  </div>
                ) : (
                  <ul className="activity-feed-list">
                    {activities.map((activity) => {
                      const actorInitial =
                        (activity.actor?.name || activity.actor?.email || "?")
                          .charAt(0)
                          .toUpperCase();
                      const actorName =
                        activity.actor?.name ||
                        (activity.actor?.email ? activity.actor.email.split("@")[0] : "Team member");
                      return (
                        <li key={activity.id} className="activity-feed-item">
                          <div className="activity-feed-avatar" title={activity.actor?.email}>
                            {activity.actor?.profilePhoto ? (
                              <img src={activity.actor.profilePhoto} alt={actorName} />
                            ) : (
                              <span>{actorInitial}</span>
                            )}
                          </div>
                          <div className="activity-feed-content">
                            <p className="activity-feed-text">
                              <strong className="activity-actor-name">{actorName}</strong>{" "}
                              <span className="activity-action-text">{formatHomeActivity(activity)}</span>
                            </p>
                            <div className="activity-feed-meta">
                              {activity.issue?.board && (
                                <Link
                                  to={`/board/${activity.issue.board.id}`}
                                  className="activity-feed-board-tag"
                                  title={`View board: ${activity.issue.board.title}`}
                                >
                                  {activity.issue.board.title}
                                </Link>
                              )}
                              <time dateTime={activity.createdAt} className="activity-feed-time">
                                {formatRelativeTime(activity.createdAt)}
                              </time>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Dialogs */}
      {showCreateBoard && (
        <CreateBoardDialog
          organizations={visibleWorkspaces
            .map(({ organization }) => organization)
            .filter(
              (organization) =>
                organization.membershipRole === "superadmin" ||
                organization.membershipRole === "admin",
            )}
          initialOrganizationId={createBoardOrganizationId ?? selectedOrgId}
          onClose={() => setShowCreateBoard(false)}
          onCreated={() => {
            setShowCreateBoard(false);
            window.dispatchEvent(new Event("stackit:boards-changed"));
          }}
        />
      )}

      {showMembersDialog && selectedWorkspace && (
        <OrganizationMembersDialog
          organizationId={selectedWorkspace.organization.id}
          organizationName={selectedWorkspace.organization.name}
          canManage={canManageWorkspace}
          boards={selectedWorkspace.boards}
          onClose={() => setShowMembersDialog(false)}
        />
      )}

      {showWorkspaceSettings && selectedWorkspace && (
        <div
          className="modal-backdrop sidebar-modal-backdrop"
          onClick={() =>
            !isSavingSettings && !isDeletingOrg && setShowWorkspaceSettings(false)
          }
        >
          <section
            className="sidebar-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-home-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3 id="workspace-home-settings-title">Workspace Settings</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowWorkspaceSettings(false)}
                disabled={isSavingSettings || isDeletingOrg}
                aria-label="Close workspace settings dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveWorkspaceSettings} className="sidebar-form">
              <label>
                <span>Workspace name</span>
                <input
                  value={settingsName}
                  onChange={(event) => setSettingsName(event.target.value)}
                  disabled={!canManageWorkspace || isSavingSettings || isDeletingOrg}
                  required
                  autoFocus
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={settingsDesc}
                  onChange={(event) => setSettingsDesc(event.target.value)}
                  disabled={!canManageWorkspace || isSavingSettings || isDeletingOrg}
                  rows={3}
                  placeholder="Workspace for our team"
                />
              </label>
              {settingsError && (
                <p className="form-error" role="alert">
                  {settingsError}
                </p>
              )}
              <div className="sidebar-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowWorkspaceSettings(false)}
                  disabled={isSavingSettings || isDeletingOrg}
                >
                  {canManageWorkspace ? "Cancel" : "Close"}
                </button>
                {canManageWorkspace && (
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSavingSettings || isDeletingOrg || !settingsName.trim()}
                  >
                    {isSavingSettings ? "Saving..." : "Save changes"}
                  </button>
                )}
              </div>
            </form>

            {canManageWorkspace && (
              <section className="danger-zone">
                <div>
                  <h4>Delete workspace</h4>
                  <p>
                    Permanently delete this workspace and remove it from your workspace list.
                    This action cannot be undone.
                  </p>
                </div>
                {confirmDeleteOrg ? (
                  <div className="danger-zone-confirm">
                    <span>Are you sure you want to delete this workspace?</span>
                    <div className="sidebar-form-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setConfirmDeleteOrg(false)}
                        disabled={isDeletingOrg}
                      >
                        Keep workspace
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void handleDeleteWorkspace()}
                        disabled={isDeletingOrg}
                      >
                        {isDeletingOrg ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setConfirmDeleteOrg(true)}
                  >
                    Delete workspace
                  </button>
                )}
              </section>
            )}
          </section>
        </div>
      )}
    </>
  );
}
