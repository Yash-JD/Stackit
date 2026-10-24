import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Link2,
  MessageSquare,
  MessageCircle,
  MessageSquareQuote,
  Pencil,
  Tag,
  Trash2,
  X,
  List,
  History,
  AlertCircle,
  Save,
  RotateCcw,
  User,
} from "lucide-react";
import {
  deleteIssue,
  deleteIssueComment,
  getIssue,
  getIssueActivity,
  getIssueComments,
  createIssueComment,
  updateIssue,
  updateIssueComment,
  notifyBoardSocket,
  type CardDetailResponse,
  type IssueActivity,
  type IssueComment,
} from "../api";
import type { CardLabel, WorkspaceLayoutContext } from "../types";
import { getAvatarGradient } from "../colors";

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString.slice(0, 10) + "T00:00:00");
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDateDisplay(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString.slice(0, 10) + "T00:00:00");
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueDateStatus(dateString: string | null) {
  if (!dateString) return null;
  const datePart = dateString.slice(0, 10);
  const target = new Date(datePart + "T00:00:00");
  if (isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      text: overdueDays === 1 ? "1 day overdue" : `${overdueDays}d overdue`,
      tone: "overdue" as const,
    };
  }
  if (diffDays === 0) {
    return { text: "Due today", tone: "today" as const };
  }
  if (diffDays === 1) {
    return { text: "Due tomorrow", tone: "upcoming" as const };
  }
  if (diffDays <= 7) {
    return { text: `In ${diffDays} days`, tone: "upcoming" as const };
  }
  return { text: `In ${diffDays} days`, tone: "normal" as const };
}

function getIsoDatePreset(offsetDays: number = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CardPage() {
  const { boardId: routeBoardId, cardId } = useParams();
  const navigate = useNavigate();
  const { toggleSidebar } = useOutletContext<WorkspaceLayoutContext>();

  const [card, setCard] = useState<CardDetailResponse | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);

  // Linear-style inline draft states for title and description
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [labelDraft, setLabelDraft] = useState<CardLabel>("Build");
  const [dueDateDraft, setDueDateDraft] = useState("");

  // Saving states
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Active focus tracking
  const [focusedField, setFocusedField] = useState<"title" | "description" | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // Delete dialog state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const boardId = routeBoardId || card?.boardId;

  const loadCardData = useCallback(async () => {
    if (!cardId) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const [cardData, commentsData, activityData] = await Promise.all([
        getIssue(cardId),
        getIssueComments(cardId),
        getIssueActivity(cardId),
      ]);
      setCard(cardData);
      setTitleDraft(cardData.title);
      setDescriptionDraft(
        cardData.description === "No description added yet."
          ? ""
          : cardData.description,
      );
      setLabelDraft(cardData.label);
      setDueDateDraft(cardData.dueDate ? cardData.dueDate.slice(0, 10) : "");
      setComments(commentsData);
      setActivities(activityData);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load card details.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    void loadCardData();
  }, [loadCardData]);

  // Real-time synchronization
  useEffect(() => {
    if (!cardId) return;
    const handleActivityChange = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        typeof event.detail === "object" &&
        event.detail !== null &&
        "issueId" in event.detail &&
        event.detail.issueId === cardId
      ) {
        void loadCardData();
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
  }, [cardId, loadCardData]);

  const cardDescriptionNormalized =
    card?.description === "No description added yet." ? "" : card?.description || "";
  const hasUnsavedChanges = Boolean(
    card &&
      (titleDraft.trim() !== card.title.trim() ||
        descriptionDraft.trim() !== cardDescriptionNormalized.trim() ||
        labelDraft !== card.label ||
        dueDateDraft !== (card.dueDate ? card.dueDate.slice(0, 10) : "")),
  );

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy card link:", err);
    }
  };

  const handleSaveInline = async () => {
    if (!cardId || !titleDraft.trim()) {
      setSaveError("Title cannot be empty");
      return;
    }
    setIsSavingChanges(true);
    setSaveError("");
    try {
      const updated = await updateIssue(
        cardId,
        titleDraft.trim(),
        descriptionDraft.trim() || "No description added yet.",
        labelDraft,
        dueDateDraft || null,
      );
      setCard((prev) => (prev ? { ...prev, ...updated } : null));
      setTitleDraft(updated.title);
      setDescriptionDraft(
        updated.description === "No description added yet."
          ? ""
          : updated.description,
      );
      setLabelDraft(updated.label);
      setDueDateDraft(updated.dueDate ? updated.dueDate.slice(0, 10) : "");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

      if (boardId) {
        notifyBoardSocket(boardId, "board_changed");
      }
      window.dispatchEvent(
        new CustomEvent("stackit:issue-activity-changed", {
          detail: { issueId: cardId },
        }),
      );
      const newActivities = await getIssueActivity(cardId);
      setActivities(newActivities);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save card changes.",
      );
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleDiscardChanges = () => {
    if (!card) return;
    setTitleDraft(card.title);
    setDescriptionDraft(
      card.description === "No description added yet." ? "" : card.description,
    );
    setLabelDraft(card.label);
    setDueDateDraft(card.dueDate ? card.dueDate.slice(0, 10) : "");
    setSaveError("");
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to save changes
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && hasUnsavedChanges) {
      e.preventDefault();
      void handleSaveInline();
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!cardId || !commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    setCommentError("");
    try {
      await createIssueComment(cardId, commentText.trim());
      setCommentText("");
      if (boardId) {
        notifyBoardSocket(boardId, "board_changed");
      }
      window.dispatchEvent(
        new CustomEvent("stackit:issue-activity-changed", {
          detail: { issueId: cardId },
        }),
      );
      const [newComments, newActivities] = await Promise.all([
        getIssueComments(cardId),
        getIssueActivity(cardId),
      ]);
      setComments(newComments);
      setActivities(newActivities);
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Unable to post comment.",
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!cardId || !editingCommentText.trim()) return;
    try {
      await updateIssueComment(commentId, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText("");
      if (boardId) {
        notifyBoardSocket(boardId, "board_changed");
      }
      const [newComments, newActivities] = await Promise.all([
        getIssueComments(cardId),
        getIssueActivity(cardId),
      ]);
      setComments(newComments);
      setActivities(newActivities);
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Unable to edit comment.",
      );
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!cardId) return;
    try {
      await deleteIssueComment(commentId);
      if (boardId) {
        notifyBoardSocket(boardId, "board_changed");
      }
      const [newComments, newActivities] = await Promise.all([
        getIssueComments(cardId),
        getIssueActivity(cardId),
      ]);
      setComments(newComments);
      setActivities(newActivities);
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Unable to delete comment.",
      );
    }
  };

  const handleDeleteCard = async () => {
    if (!cardId) return;
    setIsSubmittingDelete(true);
    setDeleteError("");
    try {
      await deleteIssue(cardId);
      if (boardId) {
        notifyBoardSocket(boardId, "board_changed");
        navigate(`/board/${boardId}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete card.",
      );
      setIsSubmittingDelete(false);
    }
  };

  const handleBack = () => {
    if (boardId) {
      navigate(`/board/${boardId}`);
    } else {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <main className="card-fullscreen-shell">
        <div className="card-fullscreen-state">
          <div className="loading-spinner" />
          <p>Loading card details...</p>
        </div>
      </main>
    );
  }

  if (loadError || !card) {
    return (
      <main className="card-fullscreen-shell">
        <div className="card-fullscreen-state card-fullscreen-error">
          <AlertCircle size={32} />
          <h2>Unable to find card</h2>
          <p>{loadError || "This card does not exist or you do not have permission to view it."}</p>
          <button type="button" className="secondary-button" onClick={handleBack}>
            <ArrowLeft size={16} /> Return to board
          </button>
        </div>
      </main>
    );
  }

  const sectionTitle = card.section?.title ?? "Board List";
  const boardTitle = card.board?.title ?? "Board";

  return (
    <main className="card-fullscreen-shell" onKeyDown={handleKeyDown}>
      {/* Navigation Topbar */}
      <header className="card-fullscreen-topbar">
        <div className="card-fullscreen-nav">
          <button
            type="button"
            className="card-back-button"
            onClick={handleBack}
            title="Back to board"
          >
            <ArrowLeft size={16} />
            <span>Back to {boardTitle}</span>
          </button>
          <div className="card-fullscreen-breadcrumbs">
            <span className="breadcrumb-muted">{boardTitle}</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-muted">{sectionTitle}</span>
            <span className="breadcrumb-separator">/</span>
            <strong className="breadcrumb-current">{card.title}</strong>
          </div>
        </div>

        <div className="card-fullscreen-actions">
          {saveSuccess && (
            <span className="card-save-status success" role="status">
              <Check size={14} /> Saved
            </span>
          )}

          <button
            type="button"
            className={`share-button ${copied ? "copied" : ""}`}
            onClick={handleShare}
            title={copied ? "Card link copied to clipboard!" : "Copy card link"}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            <span>{copied ? "Link copied!" : "Share card"}</span>
          </button>

          <button
            type="button"
            className="danger-button card-action-button"
            onClick={() => setIsDeleting(true)}
            title="Delete card"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </header>

      {/* Main Full-Screen Layout */}
      <div className="card-fullscreen-container">
        {/* Left Column: Primary Content (Title & Description Directly Editable) */}
        <section className="card-fullscreen-main">
          {/* Card Label and Status Header */}
          <div className="card-title-header">
            <div className="card-label-badge-container">
              <span className={`card-tag-badge label-${labelDraft.toLowerCase()}-badge`}>
                <span className={`label-mark label-${labelDraft.toLowerCase()}`} />
                <span className="card-label-text">{labelDraft}</span>
              </span>
              <span className="card-section-badge">
                <List size={13} /> in {sectionTitle}
              </span>
              {dueDateDraft && (
                <span
                  className={`card-header-date-badge ${
                    getDueDateStatus(dueDateDraft)?.tone === "overdue"
                      ? "overdue"
                      : ""
                  }`}
                >
                  <Calendar size={13} />
                  <span>{formatDate(dueDateDraft)}</span>
                  {getDueDateStatus(dueDateDraft) && (
                    <span
                      className={`date-status-tag ${
                        getDueDateStatus(dueDateDraft)?.tone
                      }`}
                    >
                      {getDueDateStatus(dueDateDraft)?.text}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Linear-Style Directly Editable Title */}
            <div className={`card-title-input-wrapper ${focusedField === "title" ? "focused" : ""}`}>
              <input
                type="text"
                className="card-fullscreen-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onFocus={() => setFocusedField("title")}
                onBlur={() => setFocusedField(null)}
                placeholder="Card title..."
                aria-label="Card title"
              />
            </div>
          </div>

          {/* Linear-Style Directly Editable Description Section */}
          <div
            className={`card-fullscreen-section card-description-box ${
              focusedField === "description" ? "focused" : ""
            }`}
          >
            <div className="section-header-row">
              <h3>Description</h3>
              <span className="inline-hint-text">
                {hasUnsavedChanges ? "Unsaved changes" : "Click anywhere to edit"}
              </span>
            </div>

            <textarea
              className="card-fullscreen-description-input"
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onFocus={() => setFocusedField("description")}
              onBlur={() => setFocusedField(null)}
              placeholder="Add a more detailed description... (Markdown supported)"
              aria-label="Card description"
              rows={5}
            />

            {saveError && (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            )}
          </div>

          {/* Comments Section (Enhanced font and icon before comments) */}
          <div className="card-fullscreen-section card-comments-section">
            <div className="section-header-row">
              <h3 className="comments-section-title">
                <MessageSquare size={18} className="comments-heading-icon" />
                <span>Comments</span>
                <span className="comments-count-pill">{comments.length}</span>
              </h3>
            </div>

            <form className="card-comment-form" onSubmit={handleAddComment}>
              <div className="comment-composer-wrapper">
                <div className="comment-composer-icon-prefix">
                  <MessageCircle size={16} />
                </div>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share an update or feedback on this card..."
                  aria-label="Write a comment"
                  maxLength={4000}
                  rows={3}
                  required
                />
              </div>

              {commentError && (
                <p className="form-error" role="alert">
                  {commentError}
                </p>
              )}

              <div className="comment-form-actions">
                <button
                  type="submit"
                  className="primary-button comment-post-button"
                  disabled={isSubmittingComment || !commentText.trim()}
                >
                  <MessageSquare size={14} />
                  <span>{isSubmittingComment ? "Posting..." : "Post Comment"}</span>
                </button>
              </div>
            </form>

            {comments.length === 0 ? (
              <div className="empty-comments-message">
                <MessageSquare size={20} className="empty-comments-icon" />
                <p>No comments yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="comments-stream">
                {comments.map((comment) => (
                  <article key={comment.id} className="comment-item">
                    <div
                      className="comment-avatar"
                      style={{
                        background: getAvatarGradient(comment.user.email),
                        color: "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      {comment.user.profilePhoto ? (
                        <img src={comment.user.profilePhoto} alt="" />
                      ) : (
                        comment.user.email.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <div className="comment-author-badge">
                          <User size={13} className="comment-prefix-icon" />
                          <strong className="comment-author">
                            {comment.user.email.split("@")[0]}
                          </strong>
                        </div>
                        <span className="comment-time">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                        {comment.isAuthor && (
                          <div className="comment-actions">
                            <button
                              type="button"
                              className="comment-action-btn edit"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.comment);
                              }}
                              title="Edit comment"
                            >
                              <Pencil size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="comment-action-btn delete"
                              onClick={() => handleDeleteComment(comment.id)}
                              title="Delete comment"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="comment-edit-box">
                          <textarea
                            value={editingCommentText}
                            onChange={(e) =>
                              setEditingCommentText(e.target.value)
                            }
                            rows={3}
                          />
                          <div className="comment-edit-actions">
                            <button
                              type="button"
                              className="secondary-button comment-edit-btn"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                              }}
                            >
                              <X size={13} />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              className="primary-button comment-edit-btn"
                              onClick={() => handleUpdateComment(comment.id)}
                              disabled={!editingCommentText.trim()}
                            >
                              <Check size={13} />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="comment-text-wrapper">
                          <MessageSquareQuote size={15} className="comment-text-icon" />
                          <p className="comment-text">{comment.comment}</p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Metadata & Activity */}
        <aside className="card-fullscreen-sidebar">
          {/* Metadata Panel */}
          <div className="card-metadata-card">
            <h4>Card Details</h4>

            <div className="metadata-item">
              <span className="metadata-label">
                <List size={14} /> List
              </span>
              <strong className="metadata-value">{sectionTitle}</strong>
            </div>

            <div className="metadata-item">
              <span className="metadata-label">
                <Tag size={14} /> Tag / Label
              </span>
              <select
                className="dialog-select metadata-select"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value as CardLabel)}
              >
                <option value="Design">Design</option>
                <option value="Build">Build</option>
                <option value="Research">Research</option>
              </select>
            </div>

            <div className="metadata-item date-metadata-section">
              <div className="metadata-item-header">
                <span className="metadata-label">
                  <Calendar size={14} /> Due date
                </span>
                {dueDateDraft && (
                  <button
                    type="button"
                    className="date-clear-link"
                    onClick={() => setDueDateDraft("")}
                    title="Clear due date"
                  >
                    <X size={12} /> Clear
                  </button>
                )}
              </div>

              {/* Enhanced Custom Date Card UI */}
              <div
                className={`custom-date-card ${dueDateDraft ? "has-date" : ""} ${
                  getDueDateStatus(dueDateDraft)?.tone === "overdue"
                    ? "is-overdue"
                    : ""
                }`}
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker();
                  } catch {
                    dateInputRef.current?.focus();
                  }
                }}
              >
                <div
                  className={`date-calendar-badge ${
                    getDueDateStatus(dueDateDraft)?.tone ?? "none"
                  }`}
                >
                  <Calendar size={16} />
                </div>

                <div className="date-card-content">
                  {dueDateDraft ? (
                    <div className="date-card-title-row">
                      <span className="date-formatted-title">
                        {formatDueDateDisplay(dueDateDraft)}
                      </span>
                      {getDueDateStatus(dueDateDraft) && (
                        <span
                          className={`date-status-pill ${
                            getDueDateStatus(dueDateDraft)?.tone
                          }`}
                        >
                          {getDueDateStatus(dueDateDraft)?.text}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="date-placeholder-text">
                      No due date — Click to select
                    </span>
                  )}
                </div>

                <input
                  ref={dateInputRef}
                  type="date"
                  className="hidden-date-picker-input"
                  value={dueDateDraft}
                  onChange={(e) => setDueDateDraft(e.target.value)}
                  aria-label="Select due date"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="date-quick-presets">
                <button
                  type="button"
                  className={`date-preset-pill ${
                    dueDateDraft === getIsoDatePreset(0) ? "active" : ""
                  }`}
                  onClick={() => setDueDateDraft(getIsoDatePreset(0))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`date-preset-pill ${
                    dueDateDraft === getIsoDatePreset(1) ? "active" : ""
                  }`}
                  onClick={() => setDueDateDraft(getIsoDatePreset(1))}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className={`date-preset-pill ${
                    dueDateDraft === getIsoDatePreset(7) ? "active" : ""
                  }`}
                  onClick={() => setDueDateDraft(getIsoDatePreset(7))}
                >
                  Next week
                </button>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card-metadata-card">
            <h4>
              <History size={15} /> Activity Timeline
            </h4>
            {activities.length === 0 ? (
              <p className="empty-activities-text">No recent activity</p>
            ) : (
              <div className="activity-timeline">
                {activities.map((act) => (
                  <div key={act.id} className="activity-entry">
                    <div
                      className={`activity-dot dot-${act.action
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    />
                    <div className="activity-content">
                      <p className="activity-text">
                        <strong>{act.actor.email.split("@")[0]}</strong>{" "}
                        {act.action}
                        {act.details && ` (${act.details})`}
                      </p>
                      <span className="activity-time">
                        {formatRelativeTime(act.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Save Prompt Bar (Linear-style bottom-anchored) */}
      {hasUnsavedChanges && (
        <div className="floating-save-bar" role="region" aria-label="Unsaved changes">
          <div className="floating-save-info">
            <span className="unsaved-pulsing-dot" />
            <span>Careful — you have unsaved changes!</span>
          </div>
          <div className="floating-save-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleDiscardChanges}
              disabled={isSavingChanges}
            >
              Reset
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveInline}
              disabled={isSavingChanges || !titleDraft.trim()}
            >
              <Save size={14} /> {isSavingChanges ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Delete Card Confirmation Modal */}
      {isDeleting && (
        <div
          className="modal-backdrop centered-modal-backdrop"
          onClick={() => !isSubmittingDelete && setIsDeleting(false)}
        >
          <section
            className="centered-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-form-header">
              <h3 id="card-delete-modal-title">Delete Card</h3>
              <button
                type="button"
                className="close-modal icon-button"
                onClick={() => setIsDeleting(false)}
                disabled={isSubmittingDelete}
              >
                <X size={19} />
              </button>
            </div>
            <p className="dialog-description">
              Are you sure you want to delete <strong>{card.title}</strong>? This
              action cannot be undone.
            </p>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="sidebar-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsDeleting(false)}
                disabled={isSubmittingDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDeleteCard}
                disabled={isSubmittingDelete}
              >
                {isSubmittingDelete ? "Deleting..." : "Delete card"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
