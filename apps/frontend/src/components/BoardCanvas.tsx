import { useState, type DragEvent } from "react";
import { Check, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import type { BoardColumn, Card } from "../types";

type BoardCanvasProps = {
  columns: BoardColumn[];
  onAddCard: (columnId: string) => void;
  onSelectCard: (card: Card) => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
  onMoveCard: (
    cardId: string,
    sourceColumnId: string,
    targetColumnId: string,
  ) => void;
  pendingMoveIds: string[];
  moveError: string;
  showAddList: boolean;
  newListTitle: string;
  onNewListTitleChange: (title: string) => void;
  onShowAddList: () => void;
  onAddList: () => void;
  onCancelAddList: () => void;
};

export function BoardCanvas({
  columns,
  onAddCard,
  onSelectCard,
  onEditCard,
  onDeleteCard,
  onMoveCard,
  pendingMoveIds,
  moveError,
  showAddList,
  newListTitle,
  onNewListTitleChange,
  onShowAddList,
  onAddList,
  onCancelAddList,
}: BoardCanvasProps) {
  const [draggedCard, setDraggedCard] = useState<{
    id: string;
    sourceColumnId: string;
  } | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const cardCount = columns.reduce(
    (total, column) => total + column.cards.length,
    0,
  );

  return (
    <div className="board-canvas">
      <div className="board-summary">
        <span>{cardCount} cards</span>
        <span className="summary-separator" />
        <span>Drag cards between lists to move them</span>
      </div>
      {moveError && (
        <p className="board-move-error" role="alert">
          {moveError}
        </p>
      )}
      <div className="columns-row">
        {columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            onAddCard={onAddCard}
            onSelectCard={onSelectCard}
            onEditCard={onEditCard}
            onDeleteCard={onDeleteCard}
            isDropTarget={dragOverColumnId === column.id}
            draggedCardId={draggedCard?.id ?? null}
            pendingMoveIds={pendingMoveIds}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverColumnId(column.id);
            }}
            onDragLeave={(event) => {
              if (
                !(event.relatedTarget instanceof Node) ||
                !event.currentTarget.contains(event.relatedTarget)
              ) {
                setDragOverColumnId(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverColumnId(null);
              const cardId = event.dataTransfer.getData("text/plain");
              if (draggedCard && cardId === draggedCard.id) {
                onMoveCard(
                  draggedCard.id,
                  draggedCard.sourceColumnId,
                  column.id,
                );
              }
              setDraggedCard(null);
            }}
            onCardDragStart={(cardId) => {
              const card = column.cards.find((item) => item.id === cardId);
              if (!card) return;
              setDraggedCard({ id: card.id, sourceColumnId: column.id });
            }}
            onCardDragEnd={() => {
              setDraggedCard(null);
              setDragOverColumnId(null);
            }}
          />
        ))}
        {showAddList ? (
          <div className="add-list-panel">
            <input
              autoFocus
              value={newListTitle}
              onChange={(event) => onNewListTitleChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onAddList()}
              placeholder="List name"
            />
            <div>
              <button className="confirm-button" onClick={onAddList}>
                <Check size={15} /> Add list
              </button>
              <button
                className="icon-button"
                onClick={onCancelAddList}
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button className="add-list-button" onClick={onShowAddList}>
            <Plus size={17} /> Add another list
          </button>
        )}
      </div>
    </div>
  );
}

function BoardColumnView({
  column,
  onAddCard,
  onSelectCard,
  onEditCard,
  onDeleteCard,
  isDropTarget,
  draggedCardId,
  pendingMoveIds,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
}: {
  column: BoardColumn;
  onAddCard: (columnId: string) => void;
  onSelectCard: (card: Card) => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
  isDropTarget: boolean;
  draggedCardId: string | null;
  pendingMoveIds: string[];
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onCardDragStart: (cardId: string) => void;
  onCardDragEnd: () => void;
}) {
  return (
    <section
      className={`board-column ${isDropTarget ? "board-column-drop-target" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="column-heading">
        <div className="column-title">
          <span
            className="column-color"
            style={{ backgroundColor: column.color }}
          />{" "}
          <h2>{column.title}</h2>
          <span className="card-count">{column.cards.length}</span>
        </div>
        <button
          className="icon-button subtle"
          aria-label={`Options for ${column.title}`}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
      <div className="card-list">
        {column.cards.map((card) => (
          <article
            className={`task-card ${
              draggedCardId === card.id ? "task-card-dragging" : ""
            } ${pendingMoveIds.includes(card.id) ? "task-card-moving" : ""}`}
            key={card.id}
            draggable={!pendingMoveIds.includes(card.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", card.id);
              event.dataTransfer.effectAllowed = "move";
              onCardDragStart(card.id);
            }}
            onDragEnd={onCardDragEnd}
          >
            <div className="task-card-actions">
              <button
                type="button"
                className="icon-button"
                aria-label={`Edit ${card.title}`}
                title="Edit card"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditCard(card);
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Delete ${card.title}`}
                title="Delete card"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteCard(card);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <button
              type="button"
              className="task-card-open"
              onClick={() => onSelectCard(card)}
            >
              <div className="card-label">
                <span
                  className={`label-mark label-${card.label.toLowerCase()}`}
                />
                {card.label}
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className="card-meta">
                <span className="mini-avatar">Y</span>
                {pendingMoveIds.includes(card.id) && (
                  <span className="card-moving-label" role="status">
                    Moving...
                  </span>
                )}
                {card.due && <span className="due-date">{card.due}</span>}
                <span className="card-comments">•••</span>
              </div>
            </button>
          </article>
        ))}
      </div>
      <button className="add-card-button" onClick={() => onAddCard(column.id)}>
        <Plus size={15} /> Add a card
      </button>
    </section>
  );
}

export function CardDetail({
  card,
  onClose,
  onDelete,
  onEdit,
}: {
  card: Card;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="modal-backdrop centered-modal-backdrop" onClick={onClose}>
      <aside
        className="card-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="close-modal icon-button"
          onClick={onClose}
          aria-label="Close card"
        >
          <X size={19} />
        </button>
        <div className="detail-label">
          <span className={`label-mark label-${card.label.toLowerCase()}`} />
          {card.label}
        </div>
        <h2 id="card-detail-title">{card.title}</h2>
        <p className="detail-caption">In Product launch</p>
        <div className="detail-section">
          <h4>Description</h4>
          <p>{card.description}</p>
        </div>
        <div className="detail-section">
          <h4>Activity</h4>
          <div className="activity-row">
            <div className="mini-avatar">Y</div>
            <p>
              <strong>Yash</strong> opened this card
              <br />
              <span>Just now</span>
            </p>
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="detail-actions">
            {onEdit && (
              <button className="share-button" onClick={onEdit}>
                Edit card
              </button>
            )}
            {onDelete && (
              <button className="share-button danger" onClick={onDelete}>
                Delete card
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
