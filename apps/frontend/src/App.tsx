import { useMemo, useState } from "react";
import "./index.css";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import { initialColumns } from "./board-data";
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
  // Board owns the state because several child components need to read or update it.
  const [columns, setColumns] = useState<BoardColumn[]>(initialColumns);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | CardLabel>("all");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  // visibleColumns is derived from state; it should not be stored separately.
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
          onMenuClick={() => setShowSidebar((current) => !current)}
        />
        <BoardHeader />
        <BoardToolbar
          query={query}
          activeFilter={activeFilter}
          onQueryChange={setQuery}
          onFilterChange={setActiveFilter}
        />
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
      </main>
      {selectedCard && (
        <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}

export default App;
