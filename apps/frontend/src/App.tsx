import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";
import { Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router";
import { useAuth } from "./auth";
import {
  createIssue,
  createSection,
  deleteBoard,
  deleteIssue,
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

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to="/board/product-launch" replace />} />
        <Route path="/signin" element={<SigninPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
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

function Board() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [boardTitle, setBoardTitle] = useState("Board");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | CardLabel>("all");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [boardError, setBoardError] = useState("");

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
        setColumns(nextColumns);
        return;
      }

      setColumns([]);
      setBoardTitle("Board");
      setBoardError("This board could not be found.");
    } catch (error) {
      setColumns([]);
      setBoardTitle("Board");
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

  const handleBoardRename = async () => {
    if (!boardId) return;

    const nextTitle = window.prompt("Rename board", boardTitle);
    if (!nextTitle?.trim()) return;

    try {
      await renameBoard(boardId, nextTitle.trim());
      setBoardTitle(nextTitle.trim());
      await loadBoard();
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to rename this board.",
      );
    }
  };

  const handleBoardDelete = async () => {
    if (!boardId) return;

    const confirmed = window.confirm("Delete this board? This action cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteBoard(boardId);
      navigate("/", { replace: true });
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to delete this board.",
      );
    }
  };

  const addCard = async (columnId: string) => {
    const title = window.prompt("Card title");
    if (!title?.trim()) return;

    const description =
      window.prompt("Card description", "No description added yet.") ??
      "No description added yet.";

    try {
      await createIssue(columnId, title.trim(), description.trim() || "No description added yet.");
      await loadBoard();
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to create this card.",
      );
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

  const handleEditCard = async (card: Card) => {
    const title = window.prompt("Edit card title", card.title);
    if (!title?.trim()) return;

    const description =
      window.prompt("Edit card description", card.description) ?? card.description;

    try {
      await updateIssue(card.id, title.trim(), description.trim() || "No description added yet.");
      setSelectedCard(null);
      await loadBoard();
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to update this card.",
      );
    }
  };

  const handleDeleteCard = async (card: Card) => {
    const confirmed = window.confirm(`Delete "${card.title}"?`);
    if (!confirmed) return;

    try {
      await deleteIssue(card.id);
      setSelectedCard(null);
      await loadBoard();
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to delete this card.",
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
          onRename={handleBoardRename}
          onDelete={handleBoardDelete}
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
            onAddCard={addCard}
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
          onEdit={() => void handleEditCard(selectedCard)}
          onDelete={() => void handleDeleteCard(selectedCard)}
        />
      )}
    </div>
  );
}

export default App;
