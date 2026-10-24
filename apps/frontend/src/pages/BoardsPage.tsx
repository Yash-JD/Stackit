import { useState, type FormEvent } from "react";
import { Menu, Pencil, Plus, Trash2 } from "lucide-react";
import { Link, useOutletContext } from "react-router";
import {
  deleteBoard,
  notifyBoardSocket,
  renameBoard,
  type BoardSummary,
} from "../api";
import { CreateBoardDialog } from "../components/CreateBoardDialog";
import type { WorkspaceLayoutContext } from "../types";

export type BoardManagementDialog =
  | { type: "rename"; board: BoardSummary }
  | { type: "delete"; board: BoardSummary };

export function BoardsPage() {
  const {
    toggleSidebar,
    workspaces,
    selectedOrgId,
    isLoading,
    error,
    refresh,
  } = useOutletContext<WorkspaceLayoutContext>();

  const selectedWorkspace =
    workspaces.find(({ organization }) => organization.id === selectedOrgId) ??
    workspaces[0];
  const visibleWorkspaces = selectedWorkspace ? [selectedWorkspace] : [];
  const visibleBoardCount = selectedWorkspace?.boards.length ?? 0;

  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [createBoardOrganizationId, setCreateBoardOrganizationId] = useState<string>();
  const [boardManagementDialog, setBoardManagementDialog] =
    useState<BoardManagementDialog | null>(null);
  const [boardTitle, setBoardTitle] = useState("");
  const [boardActionError, setBoardActionError] = useState("");
  const [isBoardActionSubmitting, setIsBoardActionSubmitting] = useState(false);

  const openCreateBoard = (organizationId: string) => {
    setCreateBoardOrganizationId(organizationId);
    setShowCreateBoard(true);
  };

  const openBoardManagement = (dialog: BoardManagementDialog) => {
    setBoardManagementDialog(dialog);
    setBoardTitle(dialog.type === "rename" ? dialog.board.title : "");
    setBoardActionError("");
  };

  const handleBoardAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!boardManagementDialog) return;

    setBoardActionError("");
    setIsBoardActionSubmitting(true);
    try {
      if (boardManagementDialog.type === "rename") {
        const title = boardTitle.trim();
        if (!title) {
          setBoardActionError("Board name is required.");
          return;
        }
        await renameBoard(boardManagementDialog.board.id, title);
        notifyBoardSocket(boardManagementDialog.board.id, "board_changed");
      } else {
        await deleteBoard(boardManagementDialog.board.id);
        notifyBoardSocket(boardManagementDialog.board.id, "board_deleted");
      }
      setBoardManagementDialog(null);
      window.dispatchEvent(new Event("stackit:boards-changed"));
    } catch (actionError) {
      setBoardActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update this board.",
      );
    } finally {
      setIsBoardActionSubmitting(false);
    }
  };

  return (
    <>
      <main className="board-shell workspace-home">
        <header className="workspace-home-header">
          <button
            className="icon-button mobile-menu"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu size={19} />
          </button>
          <div>
            <p className="eyebrow">WORKSPACES</p>
            <h1>Boards</h1>
            <p>Choose a board to continue, or create one for your team.</p>
          </div>
          {!isLoading && !error && (
            <div className="workspace-home-actions">
              <span className="workspace-board-total">
                {visibleBoardCount}{" "}
                {visibleBoardCount === 1 ? "board" : "boards"}
              </span>
            </div>
          )}
        </header>

        {isLoading ? (
          <div className="board-state" role="status">
            Loading your workspaces and boards...
          </div>
        ) : error ? (
          <div className="board-state board-state-error" role="alert">
            <p>{error}</p>
            <button className="secondary-button" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <section className="workspace-home-empty">
            <div className="workspace-empty-icon">✦</div>
            <h2>Create your first workspace</h2>
            <p>
              Workspaces keep your boards and team projects together. Use the
              sidebar to create one and get started.
            </p>
          </section>
        ) : (
          <div className="workspace-board-groups">
            {visibleWorkspaces.map(({ organization, boards }) => {
              const canManageWorkspace =
                organization.membershipRole === "superadmin" ||
                organization.membershipRole === "admin";
              return (
                <section
                  className="workspace-board-group"
                  key={organization.id}
                >
                  <div className="workspace-board-group-header">
                    <div className="workspace-avatar">
                      {organization.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2>{organization.name}</h2>
                      <p>
                        {boards.length}{" "}
                        {boards.length === 1 ? "board" : "boards"}
                      </p>
                    </div>
                  </div>
                  <div className="workspace-board-grid">
                    {boards.map((board, index) => (
                      <article className="workspace-board-card" key={board.id}>
                        {canManageWorkspace && (
                          <div className="workspace-board-card-actions">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Rename ${board.title}`}
                              title="Rename board"
                              onClick={() =>
                                openBoardManagement({ type: "rename", board })
                              }
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              aria-label={`Delete ${board.title}`}
                              title="Delete board"
                              onClick={() =>
                                openBoardManagement({ type: "delete", board })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                        <Link
                          className="workspace-board-card-link"
                          to={`/board/${board.id}`}
                        >
                          <span
                            className={`workspace-board-art art-${index % 4}`}
                          >
                            <span>{board.title.charAt(0).toUpperCase()}</span>
                          </span>
                          <strong>{board.title}</strong>
                        </Link>
                      </article>
                    ))}
                    {canManageWorkspace && (
                      <button
                        type="button"
                        className="workspace-board-add"
                        onClick={() => openCreateBoard(organization.id)}
                      >
                        <Plus size={17} />
                        <span>Add new board</span>
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

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

      {boardManagementDialog && (
        <div
          className="modal-backdrop centered-modal-backdrop"
          onClick={() =>
            !isBoardActionSubmitting && setBoardManagementDialog(null)
          }
        >
          <section
            className="centered-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-management-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3 id="board-management-title">
                {boardManagementDialog.type === "rename"
                  ? "Rename board"
                  : "Delete board"}
              </h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setBoardManagementDialog(null)}
                disabled={isBoardActionSubmitting}
                aria-label="Close board dialog"
              >
                ×
              </button>
            </div>
            <form className="sidebar-form" onSubmit={handleBoardAction}>
              {boardManagementDialog.type === "rename" ? (
                <label>
                  <span>Board name</span>
                  <input
                    value={boardTitle}
                    onChange={(event) => setBoardTitle(event.target.value)}
                    autoFocus
                    required
                    maxLength={120}
                  />
                </label>
              ) : (
                <p className="dialog-description">
                  Delete “{boardManagementDialog.board.title}”? This action
                  cannot be undone.
                </p>
              )}
              {boardActionError && (
                <p className="form-error" role="alert">
                  {boardActionError}
                </p>
              )}
              <div className="sidebar-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setBoardManagementDialog(null)}
                  disabled={isBoardActionSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={
                    boardManagementDialog.type === "rename"
                      ? "primary-button"
                      : "danger-button"
                  }
                  disabled={
                    isBoardActionSubmitting ||
                    (boardManagementDialog.type === "rename" &&
                      !boardTitle.trim())
                  }
                >
                  {isBoardActionSubmitting
                    ? boardManagementDialog.type === "rename"
                      ? "Saving..."
                      : "Deleting..."
                    : boardManagementDialog.type === "rename"
                      ? "Save"
                      : "Delete"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
