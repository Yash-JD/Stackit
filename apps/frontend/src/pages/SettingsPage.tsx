import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Layers,
  Menu,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import { useNavigate, useOutletContext } from "react-router";
import { deleteOrganization, updateOrganization } from "../api";
import type { WorkspaceLayoutContext } from "../types";

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    toggleSidebar,
    workspaces,
    selectedOrgId,
    isLoading,
    refresh,
  } = useOutletContext<WorkspaceLayoutContext>();

  const selectedWorkspace =
    workspaces.find(({ organization }) => organization.id === selectedOrgId) ??
    workspaces[0];

  const organization = selectedWorkspace?.organization;
  const boards = selectedWorkspace?.boards ?? [];
  const canManage =
    organization?.membershipRole === "superadmin" ||
    organization?.membershipRole === "admin";
  const isSuperadmin = organization?.membershipRole === "superadmin";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name ?? "");
      setDescription(organization.description ?? "");
      setSaveSuccess("");
      setSaveError("");
    }
  }, [organization?.id, organization?.name, organization?.description]);

  const handleCopyId = () => {
    if (!organization?.id) return;
    navigator.clipboard.writeText(organization.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !canManage) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError("Workspace name cannot be empty.");
      return;
    }

    setSaveError("");
    setSaveSuccess("");
    setIsSaving(true);
    try {
      await updateOrganization(organization.id, trimmedName, description.trim());
      window.dispatchEvent(new Event("stackit:boards-changed"));
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      await refresh();
      setSaveSuccess("Workspace settings updated successfully.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to save workspace settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!organization || !canManage) return;
    if (confirmNameInput.trim() !== organization.name.trim()) {
      setDeleteError("Workspace name confirmation does not match.");
      return;
    }

    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteOrganization(organization.id);
      window.dispatchEvent(new Event("stackit:boards-changed"));
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      await refresh();
      setShowDeleteModal(false);
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete workspace.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!organization && !isLoading) {
    return (
      <main className="board-shell workspace-home settings-page">
        <header className="workspace-home-header">
          <button
            className="icon-button mobile-menu"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu size={19} />
          </button>
          <div>
            <p className="eyebrow">WORKSPACES / SETTINGS</p>
            <h1>Workspace Settings</h1>
            <p>No workspace selected or available.</p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className="board-shell workspace-home settings-page">
      <header className="workspace-home-header">
        <button
          className="icon-button mobile-menu"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={19} />
        </button>
        <div>
          <p className="eyebrow">WORKSPACES / SETTINGS</p>
          <h1>Workspace Settings</h1>
          <p>
            Configure workspace preferences, details, and access configuration for{" "}
            <strong>{organization?.name}</strong>.
          </p>
        </div>
      </header>

      <div className="settings-content-grid">
        {/* Card 1: Workspace Overview & Information */}
        <section className="settings-card overview-card" aria-label="Workspace Details">
          <div className="settings-card-header">
            <div>
              <h3>Workspace Overview</h3>
              <p>Key information regarding your team space</p>
            </div>
            <div className="org-badge-icon">
              <Building2 size={20} />
            </div>
          </div>

          <div className="settings-info-grid">
            <div className="info-stat-item">
              <span className="stat-label">Your Permission</span>
              <div className="stat-value-badge">
                <Shield size={14} />
                <span>
                  {isSuperadmin
                    ? "Superadmin (Owner)"
                    : organization?.membershipRole === "admin"
                      ? "Admin"
                      : "Member"}
                </span>
              </div>
            </div>

            <div className="info-stat-item">
              <span className="stat-label">Active Boards</span>
              <div className="stat-value-badge stat-boards">
                <Layers size={14} />
                <span>
                  {boards.length} {boards.length === 1 ? "Board" : "Boards"}
                </span>
              </div>
            </div>

            <div className="info-stat-item full-width-stat">
              <span className="stat-label">Workspace Identifier (ID)</span>
              <div className="copy-id-row">
                <code className="org-id-code">{organization?.id}</code>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={handleCopyId}
                  title="Copy Workspace ID"
                >
                  {copiedId ? (
                    <>
                      <CheckCircle2 size={14} className="copied-icon" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: General Settings (Name & Description) */}
        <section className="settings-card form-card" aria-label="General Settings">
          <div className="settings-card-header">
            <div>
              <h3>General Information</h3>
              <p>
                {canManage
                  ? "Update your workspace name and team description."
                  : "View current workspace name and team description."}
              </p>
            </div>
          </div>

          <form className="settings-form" onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label htmlFor="settings-workspace-name">
                <span>Workspace Name</span>
                <input
                  id="settings-workspace-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  disabled={!canManage || isSaving}
                  required
                />
              </label>
              {!canManage && (
                <span className="field-note">
                  Only workspace admins and owners can modify workspace details.
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="settings-workspace-desc">
                <span>Description</span>
                <textarea
                  id="settings-workspace-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what your team does..."
                  disabled={!canManage || isSaving}
                  rows={4}
                />
              </label>
            </div>

            {saveError && (
              <div className="form-alert form-alert-error" role="alert">
                <AlertCircle size={15} />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="form-alert form-alert-success" role="status">
                <CheckCircle2 size={15} />
                <span>{saveSuccess}</span>
              </div>
            )}

            {canManage && (
              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaving || !name.trim()}
                >
                  <Save size={16} />
                  <span>{isSaving ? "Saving Changes..." : "Save Changes"}</span>
                </button>
              </div>
            )}
          </form>
        </section>

        {/* Card 3: Danger Zone */}
        {canManage && (
          <section className="settings-card danger-card" aria-label="Danger Zone">
            <div className="settings-card-header">
              <div>
                <h3 className="danger-heading">Danger Zone</h3>
                <p>Irreversible actions that affect the entire workspace</p>
              </div>
              <div className="danger-badge-icon">
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="danger-action-box">
              <div className="danger-action-text">
                <strong>Delete this workspace</strong>
                <p>
                  Permanently remove <strong>{organization?.name}</strong> and all of its
                  associated boards, cards, sections, and member permissions. This action
                  cannot be undone.
                </p>
              </div>
              <button
                type="button"
                className="primary-button danger-btn"
                onClick={() => {
                  setConfirmNameInput("");
                  setDeleteError("");
                  setShowDeleteModal(true);
                }}
              >
                <Trash2 size={16} />
                <span>Delete Workspace</span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Confirmation Modal for Deleting Workspace */}
      {showDeleteModal && (
        <div
          className="modal-backdrop centered-modal-backdrop"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="centered-dialog confirm-dialog danger-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon-danger">
              <AlertTriangle size={32} />
            </div>
            <h3>Delete Workspace</h3>
            <p>
              This will permanently delete <strong>{organization?.name}</strong>, including{" "}
              <strong>{boards.length} boards</strong> and all their task history.
            </p>
            <div className="confirm-type-instruction">
              <label htmlFor="confirm-workspace-name">
                Please type <code>{organization?.name}</code> to confirm:
              </label>
              <input
                id="confirm-workspace-name"
                type="text"
                value={confirmNameInput}
                onChange={(e) => setConfirmNameInput(e.target.value)}
                placeholder={organization?.name}
                autoFocus
              />
            </div>

            {deleteError && (
              <div className="form-alert form-alert-error" role="alert">
                <AlertCircle size={15} />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-btn"
                disabled={
                  isDeleting ||
                  confirmNameInput.trim() !== (organization?.name ?? "").trim()
                }
                onClick={() => void handleDeleteWorkspace()}
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default SettingsPage;
