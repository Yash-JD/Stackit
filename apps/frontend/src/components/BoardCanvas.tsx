import {
  useCallback,
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Check, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import type { BoardColumn, Card } from "../types";
import {
  createIssueComment,
  deleteIssueComment,
  getIssueActivity,
  getIssueComments,
  updateIssueComment,
  type IssueActivity,
  type IssueComment,
} from "../api";

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
    targetCardId: string | null,
  ) => void;
  canManageLists: boolean;
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
  canManageLists,
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
        <span>Drag cards to move them or change their order</span>
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
                  null,
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
            onCardDrop={(event, targetCardId) => {
              event.preventDefault();
              event.stopPropagation();
              const cardId = event.dataTransfer.getData("text/plain");
              if (draggedCard && cardId === draggedCard.id) {
                onMoveCard(
                  draggedCard.id,
                  draggedCard.sourceColumnId,
                  column.id,
                  targetCardId,
                );
              }
              setDraggedCard(null);
              setDragOverColumnId(null);
            }}
          />
        ))}
        {canManageLists &&
          (showAddList ? (
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
          ))}
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
  onCardDrop,
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
  onCardDrop: (event: DragEvent<HTMLElement>, targetCardId: string) => void;
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
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => onCardDrop(event, card.id)}
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
                {card.dueDate && (
                  <span className="due-date">
                    Due {formatDateOnly(card.dueDate)}
                  </span>
                )}
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
  sectionTitle,
  onClose,
  onDelete,
  onEdit,
  onActivityChanged,
}: {
  card: Card;
  sectionTitle: string;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onActivityChanged: () => void;
}) {
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const refreshCollaboration = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [nextComments, nextActivities] = await Promise.all([
        getIssueComments(card.id),
        getIssueActivity(card.id),
      ]);
      setComments(nextComments);
      setActivities(nextActivities);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load card collaboration.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [card.id]);

  useEffect(() => {
    void refreshCollaboration();
  }, [refreshCollaboration]);

  useEffect(() => {
    const handleActivityChange = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        typeof event.detail === "object" &&
        event.detail !== null &&
        "issueId" in event.detail &&
        event.detail.issueId === card.id
      ) {
        void refreshCollaboration();
      }
    };

    window.addEventListener(
      "stackit:issue-activity-changed",
      handleActivityChange,
    );
    return () =>
      window.removeEventListener(
        "stackit:issue-activity-changed",
        handleActivityChange,
      );
  }, [card.id, refreshCollaboration]);

  const handleCreateComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text || isSubmitting) return;
    setActionError("");
    setIsSubmitting(true);
    try {
      await createIssueComment(card.id, text);
      setCommentText("");
      onActivityChanged();
      await refreshCollaboration();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to add comment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveComment = async (commentId: string) => {
    const text = editingCommentText.trim();
    if (!text || isSubmitting) return;
    setActionError("");
    setIsSubmitting(true);
    try {
      await updateIssueComment(commentId, text);
      setEditingCommentId(null);
      setEditingCommentText("");
      onActivityChanged();
      await refreshCollaboration();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update comment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setActionError("");
    setIsSubmitting(true);
    try {
      await deleteIssueComment(commentId);
      onActivityChanged();
      await refreshCollaboration();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to delete comment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
          type="button"
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
        <p className="detail-caption">In {sectionTitle}</p>
        <div className="detail-section">
          <h4>Description</h4>
          <p>{card.description}</p>
        </div>
        {card.dueDate && (
          <div className="detail-section">
            <h4>Due date</h4>
            <p>{formatDateOnly(card.dueDate)}</p>
          </div>
        )}
        <div className="detail-section">
          <h4>
            Comments
            {!isLoading && !loadError && ` (${comments.length})`}
          </h4>
          <form className="comment-form" onSubmit={handleCreateComment}>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Write a comment..."
              aria-label="Write a comment"
              maxLength={4000}
              required
            />
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting || !commentText.trim()}
            >
              {isSubmitting ? "Saving..." : "Add comment"}
            </button>
          </form>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          {loadError && (
            <div className="collaboration-error" role="alert">
              <span>{loadError}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => void refreshCollaboration()}
              >
                Retry
              </button>
            </div>
          )}
          {isLoading ? (
            <p className="members-empty" role="status">
              Loading comments...
            </p>
          ) : loadError ? null : comments.length === 0 ? (
            <p className="members-empty">No comments yet.</p>
          ) : (
            <ul className="comment-list">
              {comments.map((comment) => (
                <li className="comment-item" key={comment.id}>
                  <div className="comment-heading">
                    <strong>{comment.user?.email ?? "Former member"}</strong>
                    <time dateTime={comment.createdAt}>
                      {formatTimestamp(comment.createdAt)}
                    </time>
                  </div>
                  {editingCommentId === comment.id ? (
                    <>
                      <textarea
                        value={editingCommentText}
                        onChange={(event) =>
                          setEditingCommentText(event.target.value)
                        }
                        aria-label="Edit comment"
                        maxLength={4000}
                      />
                      <div className="comment-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setEditingCommentId(null)}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void handleSaveComment(comment.id)}
                          disabled={isSubmitting || !editingCommentText.trim()}
                        >
                          Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>{comment.comment}</p>
                  )}
                  {comment.isAuthor && editingCommentId !== comment.id && (
                    <div className="comment-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditingCommentText(comment.comment);
                        }}
                        disabled={isSubmitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button danger-text"
                        onClick={() => void handleDeleteComment(comment.id)}
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="detail-section">
          <h4>Activity</h4>
          {isLoading ? (
            <p className="members-empty" role="status">
              Loading activity...
            </p>
          ) : loadError ? null : activities.length === 0 ? (
            <p className="members-empty">No activity yet.</p>
          ) : (
            <ul className="activity-list">
              {activities.map((activity) => (
                <li className="activity-row" key={activity.id}>
                  <div className="mini-avatar">
                    {activity.actor?.email.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <p>
                    <strong>{activity.actor?.email ?? "Former member"}</strong>{" "}
                    {formatActivity(activity)}
                    <br />
                    <time dateTime={activity.createdAt}>
                      {formatTimestamp(activity.createdAt)}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )}
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

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatActivity(activity: IssueActivity) {
  switch (activity.action) {
    case "created":
      return "created this card";
    case "updated":
      return `updated ${activity.details ?? "card details"}`;
    case "moved":
      return `moved this card ${activity.details ?? "to another list"}`;
    case "commented":
      return "added a comment";
    case "comment_edited":
      return "edited a comment";
    case "comment_deleted":
      return "deleted a comment";
    default:
      return "updated this card";
  }
}
