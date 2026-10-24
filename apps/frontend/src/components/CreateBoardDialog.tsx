import { useState, type FormEvent } from "react";
import { createBoard, type BoardSummary, type Organization } from "../api";

export type CreateBoardDialogProps = {
  organizations: Organization[];
  initialOrganizationId?: string;
  onClose: () => void;
  onCreated: (board: BoardSummary) => void;
};

export function CreateBoardDialog({
  organizations,
  initialOrganizationId,
  onClose,
  onCreated,
}: CreateBoardDialogProps) {
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
