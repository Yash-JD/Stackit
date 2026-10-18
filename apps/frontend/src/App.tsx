import { useMemo, useState, type FormEvent } from "react";
import "./index.css";
import { Menu, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useOutletContext,
  useParams,
} from "react-router";
import { useAuth } from "./auth";
import { createBoard, deleteBoard, renameBoard } from "./api";
import { SigninPage, SignupPage } from "./components/AuthPage";
import { BoardCanvas, CardDetail } from "./components/BoardCanvas";
import { BoardHeader, BoardTopbar } from "./components/BoardTopbar";
import { BoardToolbar } from "./components/BoardToolbar";
import { Sidebar } from "./components/Sidebar";
import type { Card, CardLabel } from "./types";
import type { BoardSummary, Organization } from "./api";
import { useBoard } from "./hooks/useBoard";
import { useWorkspaceBoards } from "./hooks/useWorkspaceBoards";

type BoardDialog =
  | { type: "create-card"; columnId: string }
  | { type: "edit-card"; card: Card }
  | { type: "delete-card"; card: Card };

type BoardManagementDialog =
  | { type: "rename"; board: BoardSummary }
  | { type: "delete"; board: BoardSummary };

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/signin" element={<SigninPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceLayout />}>
            <Route path="/" element={<WorkspaceHome />} />
            <Route path="/board/:boardId" element={<Board />} />
          </Route>
        </Route>
      </Routes>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/signin" replace />;
}

type WorkspaceLayoutContext = ReturnType<typeof useWorkspaceBoards> & {
  toggleSidebar: () => void;
};

function WorkspaceLayout() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const workspaceBoards = useWorkspaceBoards();

  return (
    <div
      className={`workspace-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() =>
          setIsSidebarCollapsed((isCollapsed) => !isCollapsed)
        }
      />
      <Outlet
        context={{
          ...workspaceBoards,
          toggleSidebar: () => setShowSidebar((current) => !current),
        }}
      />
    </div>
  );
}

function CreateBoardDialog({
  organizations,
  initialOrganizationId,
  onClose,
  onCreated,
}: {
  organizations: Organization[];
  initialOrganizationId?: string;
  onClose: () => void;
  onCreated: (board: BoardSummary) => void;
}) {
  const [organizationId, setOrganizationId] = useState(
    initialOrganizationId ?? organizations[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId || !title.trim()) return;

    setError("");
    setIsSubmitting(true);
    try {
      const board = await createBoard(organizationId, title.trim());
      onCreated(board);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create this board.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop sidebar-modal-backdrop"
      onClick={() => !isSubmitting && onClose()}
    >
      <section
        className="sidebar-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-board-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sidebar-form-header">
          <h3 id="create-board-title">Create board</h3>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close create board dialog"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="sidebar-form">
          {organizations.length > 1 && (
            <label>
              <span>Workspace</span>
              <select
                className="dialog-select"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Board name</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Product launch"
              required
              autoFocus
              maxLength={120}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="sidebar-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting || !organizationId || !title.trim()}
            >
              {isSubmitting ? "Creating..." : "Create board"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function WorkspaceHome() {
  const { toggleSidebar, workspaces, boardCount, isLoading, error, refresh } =
    useOutletContext<WorkspaceLayoutContext>();
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [createBoardOrganizationId, setCreateBoardOrganizationId] =
    useState<string>();
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
      } else {
        await deleteBoard(boardManagementDialog.board.id);
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
                {boardCount} {boardCount === 1 ? "board" : "boards"}
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
            {workspaces.map(({ organization, boards }) => (
              <section className="workspace-board-group" key={organization.id}>
                <div className="workspace-board-group-header">
                  <div className="workspace-avatar">
                    {organization.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2>{organization.name}</h2>
                    <p>
                      {boards.length} {boards.length === 1 ? "board" : "boards"}
                    </p>
                  </div>
                </div>
                <div className="workspace-board-grid">
                  {boards.map((board, index) => (
                    <article className="workspace-board-card" key={board.id}>
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
                  <button
                    type="button"
                    className="workspace-board-add"
                    onClick={() => openCreateBoard(organization.id)}
                  >
                    <Plus size={17} />
                    <span>Add new board</span>
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      {showCreateBoard && (
        <CreateBoardDialog
          organizations={workspaces.map(({ organization }) => organization)}
          initialOrganizationId={createBoardOrganizationId}
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
                    boardManagementDialog.type === "delete"
                      ? "danger-button"
                      : "primary-button"
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

function Board() {
  const { toggleSidebar } = useOutletContext<WorkspaceLayoutContext>();
  const { boardId } = useParams();
  const {
    columns,
    title: boardTitle,
    isLoading: isLoadingBoard,
    error: boardError,
    pendingMoveIds,
    moveError,
    addSection,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  } = useBoard(boardId);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | CardLabel>("all");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSubmittingDialog, setIsSubmittingDialog] = useState(false);
  const visibleColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          const matchesSearch = card.title
            .toLowerCase()
            .includes(query.toLowerCase());
          const matchesFilter =
            activeFilter === "all" || card.label === activeFilter;
          return matchesSearch && matchesFilter;
        }),
      })),
    [activeFilter, columns, query],
  );

  const openDialog = (nextDialog: BoardDialog) => {
    setDialog(nextDialog);
    setDialogError("");
    if (nextDialog.type === "create-card") {
      setDialogTitle("");
      setDialogDescription("");
    } else if (nextDialog.type === "edit-card") {
      setDialogTitle(nextDialog.card.title);
      setDialogDescription(nextDialog.card.description);
    }
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog) return;

    const title = dialogTitle.trim();
    if (
      (dialog.type === "create-card" || dialog.type === "edit-card") &&
      !title
    ) {
      setDialogError("A title is required.");
      return;
    }

    setDialogError("");
    setIsSubmittingDialog(true);
    try {
      switch (dialog.type) {
        case "create-card":
          await createCard(
            dialog.columnId,
            title,
            dialogDescription.trim() || "No description added yet.",
          );
          break;
        case "edit-card":
          await updateCard(
            dialog.card.id,
            title,
            dialogDescription.trim() || "No description added yet.",
          );
          setSelectedCard(null);
          break;
        default:
          return;
      }
      setDialog(null);
    } catch (error) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "Unable to save these changes.",
      );
    } finally {
      setIsSubmittingDialog(false);
    }
  };

  const handleDialogConfirm = async () => {
    if (!dialog) return;
    setDialogError("");
    setIsSubmittingDialog(true);
    try {
      if (dialog.type === "delete-card") {
        await deleteCard(dialog.card.id);
        setDialog(null);
        setSelectedCard(null);
      }
    } catch (error) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "Unable to complete this action.",
      );
    } finally {
      setIsSubmittingDialog(false);
    }
  };

  const addList = async () => {
    if (!boardId || !newListTitle.trim()) {
      setShowAddList(false);
      setNewListTitle("");
      return;
    }

    const wasCreated = await addSection(newListTitle.trim());
    if (wasCreated) {
      setNewListTitle("");
      setShowAddList(false);
    }
  };

  return (
    <>
      <main className="board-shell">
        <BoardTopbar boardTitle={boardTitle} onMenuClick={toggleSidebar} />
        <BoardHeader title={boardTitle} />
        <BoardToolbar
          query={query}
          activeFilter={activeFilter}
          onQueryChange={setQuery}
          onFilterChange={setActiveFilter}
        />
        {isLoadingBoard ? (
          <div className="board-state">Loading board...</div>
        ) : boardError ? (
          <div className="board-state board-state-error" role="alert">
            {boardError}
          </div>
        ) : (
          <BoardCanvas
            columns={visibleColumns}
            onMoveCard={(cardId, sourceColumnId, targetColumnId) => {
              void moveCard(cardId, sourceColumnId, targetColumnId);
            }}
            pendingMoveIds={pendingMoveIds}
            moveError={moveError}
            onAddCard={(columnId) =>
              openDialog({ type: "create-card", columnId })
            }
            onSelectCard={setSelectedCard}
            onEditCard={(card) => openDialog({ type: "edit-card", card })}
            onDeleteCard={(card) => openDialog({ type: "delete-card", card })}
            showAddList={showAddList}
            newListTitle={newListTitle}
            onNewListTitleChange={setNewListTitle}
            onShowAddList={() => setShowAddList(true)}
            onAddList={addList}
            onCancelAddList={() => setShowAddList(false)}
          />
        )}
      </main>
      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onEdit={() => {
            const card = selectedCard;
            setSelectedCard(null);
            openDialog({ type: "edit-card", card });
          }}
          onDelete={() => {
            const card = selectedCard;
            setSelectedCard(null);
            openDialog({ type: "delete-card", card });
          }}
        />
      )}
      {dialog && (
        <div
          className="modal-backdrop centered-modal-backdrop"
          onClick={() => !isSubmittingDialog && setDialog(null)}
        >
          <section
            className="centered-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3 id="board-dialog-title">
                {dialog.type === "create-card"
                  ? "Create card"
                  : dialog.type === "edit-card"
                    ? "Edit card"
                    : "Delete card"}
              </h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDialog(null)}
                disabled={isSubmittingDialog}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            {dialog.type === "delete-card" ? (
              <div className="sidebar-form">
                <p className="dialog-description">
                  {`Delete "${dialog.card.title}"? This action cannot be undone.`}
                </p>
                {dialogError && (
                  <p className="form-error" role="alert">
                    {dialogError}
                  </p>
                )}
                <div className="sidebar-form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setDialog(null)}
                    disabled={isSubmittingDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleDialogConfirm()}
                    disabled={isSubmittingDialog}
                  >
                    {isSubmittingDialog ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDialogSubmit} className="sidebar-form">
                <label>
                  <span>Card title</span>
                  <input
                    value={dialogTitle}
                    onChange={(event) => setDialogTitle(event.target.value)}
                    required
                    autoFocus
                    maxLength={120}
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    value={dialogDescription}
                    onChange={(event) =>
                      setDialogDescription(event.target.value)
                    }
                    placeholder="Add a description"
                  />
                </label>
                {dialogError && (
                  <p className="form-error" role="alert">
                    {dialogError}
                  </p>
                )}
                <div className="sidebar-form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setDialog(null)}
                    disabled={isSubmittingDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSubmittingDialog || !dialogTitle.trim()}
                  >
                    {isSubmittingDialog
                      ? "Saving..."
                      : dialog.type === "create-card"
                        ? "Create card"
                        : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default App;
