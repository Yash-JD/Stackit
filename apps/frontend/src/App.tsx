import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router";
import { useAuth } from "./auth";
import { getBoardSections, getIssuesForSection, getOrganizations } from "./api";
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

  useEffect(() => {
    let isCurrent = true;

    const loadBoard = async () => {
      if (!boardId) return;

      setIsLoadingBoard(true);
      setBoardError("");

      try {
        const organizations = await getOrganizations();
        if (!isCurrent) return;

        for (const organization of organizations) {
          const sectionsResponse = await getBoardSections(organization.id);
          const matchingBoard = sectionsResponse.find(
            (board) => board.id === boardId,
          );

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
                const color = sectionColors[index % sectionColors.length] ?? "#8d9baa";

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
                        description: issue.description || "No description added yet.",
                      };
                    }),
                } satisfies BoardColumn;
              }),
          );

          if (isCurrent) {
            setBoardTitle(matchingBoard.title);
            setColumns(nextColumns);
          }
          return;
        }

        if (isCurrent) {
          setColumns([]);
          setBoardTitle("Board");
          setBoardError("This board could not be found.");
        }
      } catch (error) {
        if (!isCurrent) return;
        setColumns([]);
        setBoardTitle("Board");
        setBoardError(
          error instanceof Error ? error.message : "Unable to load board data.",
        );
      } finally {
        if (isCurrent) setIsLoadingBoard(false);
      }
    };

    void loadBoard();

    return () => {
      isCurrent = false;
    };
  }, [boardId]);

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

  const addCard = (columnId: string) => {
    const title = window.prompt("Card title");
    if (!title?.trim()) return;

    const card: Card = {
      id: crypto.randomUUID(),
      title: title.trim(),
      label: "Build",
      description: "A new card ready for the next step.",
    };

    setColumns((current) =>
      current.map((column) =>
        column.id === columnId
          ? { ...column, cards: [...column.cards, card] }
          : column,
      ),
    );
  };

  const addList = () => {
    if (!newListTitle.trim()) return;

    setColumns((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: newListTitle.trim(),
        color: "#c69adf",
        cards: [],
      },
    ]);
    setNewListTitle("");
    setShowAddList(false);
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
        <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}

export default App;
