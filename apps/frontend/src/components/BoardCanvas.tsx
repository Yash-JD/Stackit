import { Check, MoreHorizontal, Plus, X } from "lucide-react";
import type { BoardColumn, Card } from "../types";

type BoardCanvasProps = {
  columns: BoardColumn[];
  onAddCard: (columnId: string) => void;
  onSelectCard: (card: Card) => void;
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
  showAddList,
  newListTitle,
  onNewListTitleChange,
  onShowAddList,
  onAddList,
  onCancelAddList,
}: BoardCanvasProps) {
  const cardCount = columns.reduce(
    (total, column) => total + column.cards.length,
    0,
  );

  return (
    <div className="board-canvas">
      <div className="board-summary">
        <span>{cardCount} cards</span>
        <span className="summary-separator" />
        <span>Updated just now</span>
      </div>
      <div className="columns-row">
        {columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            onAddCard={onAddCard}
            onSelectCard={onSelectCard}
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
}: {
  column: BoardColumn;
  onAddCard: (columnId: string) => void;
  onSelectCard: (card: Card) => void;
}) {
  return (
    <section className="board-column">
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
          <button
            className="task-card"
            key={card.id}
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
              {card.due && <span className="due-date">{card.due}</span>}
              <span className="card-comments">•••</span>
            </div>
          </button>
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
}: {
  card: Card;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <aside
        className="card-detail"
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
        <h2>{card.title}</h2>
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
      </aside>
    </div>
  );
}
