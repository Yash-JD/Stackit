import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { BoardCanvas } from "../components/BoardCanvas";
import { BoardHeader, BoardTopbar } from "../components/BoardTopbar";
import { BoardToolbar } from "../components/BoardToolbar";
import { useBoard } from "../hooks/useBoard";
import type { Card, CardLabel, WorkspaceLayoutContext } from "../types";

export type BoardDialog =
  | { type: "create-card"; columnId: string }
  | { type: "edit-card"; card: Card }
  | { type: "delete-card"; card: Card };

export function BoardPage() {
  const { toggleSidebar } = useOutletContext<WorkspaceLayoutContext>();
  const navigate = useNavigate();
  const { boardId } = useParams();
  const {
    columns,
    title: boardTitle,
    canManageBoard,
    isLoading: isLoadingBoard,
    error: boardError,
    pendingMoveIds,
    moveError,
    presenceUsers,
    socketStatus,
    retryBoardSocket,
    notifyBoardChanged,
    refresh: refreshBoard,
    addSection,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  } = useBoard(boardId);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | CardLabel>("all");
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogLabel, setDialogLabel] = useState<CardLabel>("Build");
  const [dialogDueDate, setDialogDueDate] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSubmittingDialog, setIsSubmittingDialog] = useState(false);

  useEffect(() => {
    const handleBoardDeleted = () => navigate("/", { replace: true });
    window.addEventListener("stackit:board-deleted", handleBoardDeleted);
    return () =>
      window.removeEventListener("stackit:board-deleted", handleBoardDeleted);
  }, [navigate]);

  const visibleColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          const matchesSearch =
            card.title.toLowerCase().includes(query.toLowerCase()) ||
            card.description.toLowerCase().includes(query.toLowerCase());
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
      setDialogLabel("Build");
      setDialogDueDate("");
    } else if (nextDialog.type === "edit-card") {
      setDialogTitle(nextDialog.card.title);
      setDialogDescription(nextDialog.card.description);
      setDialogLabel(nextDialog.card.label);
      setDialogDueDate(nextDialog.card.dueDate?.slice(0, 10) ?? "");
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
            dialogLabel,
            dialogDueDate || null,
          );
          break;
        case "edit-card":
          await updateCard(
            dialog.card.id,
            title,
            dialogDescription.trim() || "No description added yet.",
            dialogLabel,
            dialogDueDate || null,
          );
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
      <main className="board-shell" aria-busy={isLoadingBoard}>
        <BoardTopbar
          boardTitle={boardTitle}
          onMenuClick={toggleSidebar}
          presenceUsers={presenceUsers}
          socketStatus={socketStatus}
          onRetrySocket={retryBoardSocket}
        />
        <BoardHeader title={boardTitle} boardId={boardId} />
        <BoardToolbar
          query={query}
          activeFilter={activeFilter}
          onQueryChange={setQuery}
          onFilterChange={setActiveFilter}
        />
        {isLoadingBoard ? (
          <div className="board-state" role="status" aria-live="polite">
            Loading board…
          </div>
        ) : boardError ? (
          <div className="board-state board-state-error" role="alert">
            <p>{boardError}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void refreshBoard()}
            >
              Try again
            </button>
          </div>
        ) : (
          <BoardCanvas
            columns={visibleColumns}
            canReorder={query.trim() === "" && activeFilter === "all"}
            onMoveCard={(
              cardId,
              sourceColumnId,
              targetColumnId,
              targetCardId,
            ) => {
              void moveCard(
                cardId,
                sourceColumnId,
                targetColumnId,
                targetCardId,
              );
            }}
            pendingMoveIds={pendingMoveIds}
            moveError={moveError}
            canManageLists={canManageBoard}
            onAddCard={(columnId) =>
              openDialog({ type: "create-card", columnId })
            }
            onSelectCard={(card) => {
              if (boardId) {
                navigate(`/board/${boardId}/card/${card.id}`);
              } else {
                navigate(`/card/${card.id}`);
              }
            }}
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
      {dialog && (
        <div
          className="modal-backdrop centered-modal-backdrop"
          onClick={() => !isSubmittingDialog && setDialog(null)}
        >
          <section
            className={`centered-dialog ${
              dialog.type === "delete-card" ? "" : "card-edit-dialog"
            }`}
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
                <label>
                  <span>Label</span>
                  <select
                    className="dialog-select"
                    value={dialogLabel}
                    onChange={(event) =>
                      setDialogLabel(
                        event.target.value === "Design" ||
                          event.target.value === "Research"
                          ? event.target.value
                          : "Build",
                      )
                    }
                  >
                    <option value="Design">Design</option>
                    <option value="Build">Build</option>
                    <option value="Research">Research</option>
                  </select>
                </label>
                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    value={dialogDueDate}
                    onChange={(event) => setDialogDueDate(event.target.value)}
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
