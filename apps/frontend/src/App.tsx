import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import "./index.css";
import { Menu } from "lucide-react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router";
import { useAuth } from "./auth";
import {
  createBoard,
  createIssue,
  createSection,
  deleteBoard,
  deleteIssue,
  getBoards,
  getBoardSections,
  getIssuesForSection,
  getOrganizations,
  renameBoard,
  updateIssue,
} from "./api";
import { SigninPage, SignupPage } from "./components/AuthPage";
import { BoardCanvas, CardDetail } from "./components/BoardCanvas";
import { BoardHeader, BoardTopbar } from "./components/BoardTopbar";
import { BoardToolbar } from "./components/BoardToolbar";
import { Sidebar } from "./components/Sidebar";
import type { BoardColumn, Card, CardLabel } from "./types";
import type { BoardSummary, Organization } from "./api";

type BoardDialog =
  | { type: "rename-board" }
  | { type: "create-board" }
  | { type: "create-card"; columnId: string }
  | { type: "edit-card"; card: Card }
  | { type: "delete-board" }
  | { type: "delete-card"; card: Card };

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/signin" element={<SigninPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<WorkspaceHome />} />
          <Route path="/board/:boardId" element={<Board />} />
        </Route>
      </Routes>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/signin" replace />;
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
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [workspaces, setWorkspaces] = useState<
    Array<{ organization: Organization; boards: BoardSummary[] }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const loadWorkspaceBoards = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const organizations = await getOrganizations();
      const groups = await Promise.all(
        organizations.map(async (organization) => ({
          organization,
          boards: await getBoards(organization.id),
        })),
      );
      setWorkspaces(groups);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load workspace boards.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceBoards();
  }, [loadWorkspaceBoards, retry]);

  useEffect(() => {
    const refreshWorkspaces = () => {
      void loadWorkspaceBoards();
    };
    window.addEventListener("stackit:organizations-changed", refreshWorkspaces);
    return () =>
      window.removeEventListener(
        "stackit:organizations-changed",
        refreshWorkspaces,
      );
  }, [loadWorkspaceBoards]);

  const boardCount = workspaces.reduce(
    (total, workspace) => total + workspace.boards.length,
    0,
  );

  return (
    <div className="workspace-shell">
      <Sidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
      <main className="board-shell workspace-home">
        <header className="workspace-home-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setShowSidebar((current) => !current)}
            aria-label="Toggle sidebar"
          >
            <Menu size={19} />
          </button>
          <div>
            <p className="eyebrow">WORKSPACES</p>
            <h1>Your boards</h1>
            <p>Choose a board to continue, or create one for your team.</p>
          </div>
          {!isLoading && !error && (
            <div className="workspace-home-actions">
              <span className="workspace-board-total">
                {boardCount} {boardCount === 1 ? "board" : "boards"}
              </span>
              {workspaces.length > 0 && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setShowCreateBoard(true)}
                >
                  New board
                </button>
              )}
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
            <button
              className="secondary-button"
              onClick={() => setRetry((current) => current + 1)}
            >
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
                {boards.length > 0 ? (
                  <div className="workspace-board-grid">
                    {boards.map((board, index) => (
                      <Link
                        className="workspace-board-card"
                        key={board.id}
                        to={`/board/${board.id}`}
                      >
                        <span className={`workspace-board-art art-${index % 4}`}>
                          <span>{board.title.charAt(0).toUpperCase()}</span>
                        </span>
                        <strong>{board.title}</strong>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="workspace-no-boards">
                    No boards in this workspace yet. Select “New board” above
                    to create one.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
      {showCreateBoard && (
        <CreateBoardDialog
          organizations={workspaces.map(({ organization }) => organization)}
          onClose={() => setShowCreateBoard(false)}
          onCreated={() => {
            setShowCreateBoard(false);
            window.dispatchEvent(new Event("stackit:boards-changed"));
            void loadWorkspaceBoards();
          }}
        />
      )}
    </div>
  );
}

function Board() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [boardTitle, setBoardTitle] = useState("Board");
  const [boardOrganizationId, setBoardOrganizationId] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | CardLabel>("all");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [boardError, setBoardError] = useState("");
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSubmittingDialog, setIsSubmittingDialog] = useState(false);

  const loadBoard = useCallback(async () => {
    if (!boardId) return;

    setIsLoadingBoard(true);
    setBoardError("");

    try {
      const organizations = await getOrganizations();

      for (const organization of organizations) {
        const sectionsResponse = await getBoardSections(organization.id);
        const matchingBoard = sectionsResponse.find((board) => board.id === boardId);

        if (!matchingBoard) continue;

        const sectionColors = [
          "#8d9baa",
          "#edb44f",
          "#6ec5b8",
          "#88a9df",
        ];
        const labels: CardLabel[] = ["Research", "Build", "Design"];

        const nextColumns = await Promise.all(
          matchingBoard.sections
            .filter((section) => !section.isDeleted)
            .map(async (section, index) => {
              const issues = await getIssuesForSection(section.id);
              const color =
                sectionColors[index % sectionColors.length] ?? "#8d9baa";

              return {
                id: section.id,
                title: section.title,
                color,
                cards: issues
                  .filter((issue) => !issue.isDeleted)
                  .map((issue, issueIndex) => {
                    const label =
                      labels[issueIndex % labels.length] ?? "Build";

                    return {
                      id: issue.id,
                      title: issue.title,
                      label,
                      description:
                        issue.description || "No description added yet.",
                    };
                  }),
              } satisfies BoardColumn;
            }),
        );

        setBoardTitle(matchingBoard.title);
        setBoardOrganizationId(matchingBoard.orgId);
        setColumns(nextColumns);
        return;
      }

      setColumns([]);
      setBoardTitle("Board");
      setBoardOrganizationId("");
      setBoardError("This board could not be found.");
    } catch (error) {
      setColumns([]);
      setBoardTitle("Board");
      setBoardOrganizationId("");
      setBoardError(
        error instanceof Error ? error.message : "Unable to load board data.",
      );
    } finally {
      setIsLoadingBoard(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!boardId) {
      setBoardError("This board could not be found.");
      setIsLoadingBoard(false);
      return;
    }

    void loadBoard();
  }, [boardId, loadBoard]);

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
    if (nextDialog.type === "rename-board") {
      setDialogTitle(boardTitle);
      setDialogDescription("");
    } else if (nextDialog.type === "create-card") {
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
      (dialog.type === "rename-board" ||
        dialog.type === "create-board" ||
        dialog.type === "create-card" ||
        dialog.type === "edit-card") &&
      !title
    ) {
      setDialogError("A title is required.");
      return;
    }

    setDialogError("");
    setIsSubmittingDialog(true);
    try {
      switch (dialog.type) {
        case "rename-board":
          if (!boardId) return;
          await renameBoard(boardId, title);
          setBoardTitle(title);
          break;
        case "create-board": {
          if (!boardOrganizationId) {
            setDialogError("Unable to determine this board's workspace.");
            return;
          }
          const newBoard = await createBoard(boardOrganizationId, title);
          setDialog(null);
          window.dispatchEvent(new Event("stackit:boards-changed"));
          navigate(`/board/${newBoard.id}`);
          return;
        }
        case "create-card":
          await createIssue(
            dialog.columnId,
            title,
            dialogDescription.trim() || "No description added yet.",
          );
          break;
        case "edit-card":
          await updateIssue(
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
      await loadBoard();
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "Unable to save these changes.",
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
      if (dialog.type === "delete-board") {
        if (!boardId) return;
        await deleteBoard(boardId);
        setDialog(null);
        navigate("/", { replace: true });
      } else if (dialog.type === "delete-card") {
        await deleteIssue(dialog.card.id);
        setDialog(null);
        setSelectedCard(null);
        await loadBoard();
      }
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "Unable to complete this action.",
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

    try {
      await createSection(boardId, newListTitle.trim());
      setNewListTitle("");
      setShowAddList(false);
      await loadBoard();
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to create this list.",
      );
    }
  };

  return (
    <div className="workspace-shell">
      <Sidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
      <main className="board-shell">
        <BoardTopbar
          boardId={boardId}
          boardTitle={boardTitle}
          onMenuClick={() => setShowSidebar((current) => !current)}
        />
        <BoardHeader
          title={boardTitle}
          onRename={() => openDialog({ type: "rename-board" })}
          onCreateBoard={() => openDialog({ type: "create-board" })}
          onDelete={() => openDialog({ type: "delete-board" })}
        />
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
            onAddCard={(columnId) =>
              openDialog({ type: "create-card", columnId })
            }
            onSelectCard={setSelectedCard}
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
                {dialog.type === "rename-board"
                  ? "Rename board"
                  : dialog.type === "create-board"
                    ? "Create board"
                  : dialog.type === "create-card"
                    ? "Create card"
                    : dialog.type === "edit-card"
                      ? "Edit card"
                      : dialog.type === "delete-board"
                        ? "Delete board"
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
            {dialog.type === "delete-board" ||
            dialog.type === "delete-card" ? (
              <div className="sidebar-form">
                <p className="dialog-description">
                  {dialog.type === "delete-board"
                    ? "Delete this board? This action cannot be undone."
                    : `Delete "${dialog.card.title}"? This action cannot be undone.`}
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
                  <span>
                    {dialog.type === "rename-board" ||
                    dialog.type === "create-board"
                      ? "Board name"
                      : "Card title"}
                  </span>
                  <input
                    value={dialogTitle}
                    onChange={(event) => setDialogTitle(event.target.value)}
                    required
                    autoFocus
                    maxLength={120}
                  />
                </label>
                {dialog.type !== "rename-board" &&
                  dialog.type !== "create-board" && (
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
                )}
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
                      : dialog.type === "rename-board"
                        ? "Save changes"
                        : dialog.type === "create-card"
                          ? "Create card"
                          : dialog.type === "create-board"
                            ? "Create board"
                          : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
