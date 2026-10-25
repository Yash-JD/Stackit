import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AUTH_TOKEN_KEY,
  acceptInvitation,
  getOrganizationInvitations,
  getOrganizationMembers,
  getPendingInvitations,
  inviteOrganizationMember,
  rejectInvitation,
  removeOrganizationMember,
  updateOrganizationMemberBoards,
  updateOrganizationMemberRole,
  type OrganizationInvitation,
  type OrganizationMember,
  type BoardSummary,
} from "../api";
import { getAvatarGradient } from "../colors";

type OrganizationMembersDialogProps = {
  organizationId: string;
  organizationName: string;
  canManage: boolean;
  boards: BoardSummary[];
  onClose: () => void;
};

const WEBSOCKET_URL =
  import.meta.env?.BUN_PUBLIC_WS_URL ?? "ws://localhost:8080";

export function OrganizationMembersDialog({
  organizationId,
  organizationName,
  canManage,
  boards,
  onClose,
}: OrganizationMembersDialogProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [organizationInvitations, setOrganizationInvitations] = useState<
    OrganizationInvitation[]
  >([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    OrganizationInvitation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [activeActionId, setActiveActionId] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [boardSelections, setBoardSelections] = useState<
    Record<string, string[]>
  >({});
  const [socketNotice, setSocketNotice] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const joinedOrganizationRef = useRef(false);
  const failedInvitationIdsRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadErrors([]);
    const [membersResult, organizationInvitationsResult, pendingResult] =
      await Promise.allSettled([
        canManage
          ? getOrganizationMembers(organizationId)
          : Promise.resolve([]),
        canManage
          ? getOrganizationInvitations(organizationId)
          : Promise.resolve([]),
        getPendingInvitations(),
      ]);

    const errors: string[] = [];
    if (membersResult.status === "fulfilled") {
      setMembers(membersResult.value);
    } else {
      setMembers([]);
      errors.push(`Workspace members: ${errorMessage(membersResult.reason)}`);
    }

    if (organizationInvitationsResult.status === "fulfilled") {
      setOrganizationInvitations(organizationInvitationsResult.value);
    } else {
      setOrganizationInvitations([]);
      errors.push(
        `Workspace invitations: ${errorMessage(organizationInvitationsResult.reason)}`,
      );
    }

    if (pendingResult.status === "fulfilled") {
      setPendingInvitations(pendingResult.value);
    } else {
      setPendingInvitations([]);
      errors.push(`Invitations for you: ${errorMessage(pendingResult.reason)}`);
    }

    setLoadErrors(errors);
    setIsLoading(false);
  }, [canManage, organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setBoardSelections(
      Object.fromEntries(
        members.map((member) => [
          member.userId,
          member.boardMemberships.map((grant) => grant.board.id),
        ]),
      ),
    );
  }, [members]);

  useEffect(() => {
    if (!canManage) return;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    setSocketNotice("");
    const socket = new WebSocket(
      `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`,
    );
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          type: "join_organization",
          organizationId,
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return;
      }

      if (typeof message !== "object" || message === null) return;
      if ("type" in message && message.type === "organization_access_denied") {
        setSocketNotice(
          "Live invitation updates are unavailable for this workspace.",
        );
        return;
      }
      if (
        "type" in message &&
        message.type === "organization_joined" &&
        "organizationId" in message &&
        message.organizationId === organizationId
      ) {
        joinedOrganizationRef.current = true;
        failedInvitationIdsRef.current.forEach((invitationId) => {
          socket.send(
            JSON.stringify({
              type: "invitation_failed",
              invitationId,
              organizationId,
            }),
          );
        });
        failedInvitationIdsRef.current = [];
        return;
      }

      if (
        "type" in message &&
        message.type === "invitation_failed" &&
        "organizationId" in message &&
        message.organizationId === organizationId
      ) {
        setSocketNotice(
          "An invitation email failed to send. The workspace invitation list was refreshed.",
        );
        void refresh();
      }
    });

    socket.addEventListener("close", () => {
      joinedOrganizationRef.current = false;
    });
    socket.addEventListener("error", () => {
      setSocketNotice(
        "Live invitation updates are unavailable. Invitation status is still saved and can be refreshed.",
      );
    });

    return () => {
      joinedOrganizationRef.current = false;
      failedInvitationIdsRef.current = [];
      if (socketRef.current === socket) socketRef.current = null;
      socket.close();
    };
  }, [canManage, organizationId, refresh]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const inviteEmail = email.trim().toLowerCase();
    if (!inviteEmail || selectedBoardIds.length === 0) return;

    setInviteError("");
    setSuccessMessage("");
    setIsInviting(true);
    try {
      const invitation = await inviteOrganizationMember(
        organizationId,
        inviteEmail,
        selectedBoardIds,
      );
      setEmail("");
      setSelectedBoardIds([]);
      if (invitation.emailSent) {
        setSuccessMessage(`Invitation sent to ${inviteEmail}.`);
      } else {
        setInviteError(
          `The invitation was recorded, but the email to ${inviteEmail} could not be sent.`,
        );
        if (joinedOrganizationRef.current) {
          socketRef.current?.send(
            JSON.stringify({
              type: "invitation_failed",
              invitationId: invitation.invitationId,
              organizationId,
            }),
          );
        } else {
          failedInvitationIdsRef.current.push(invitation.invitationId);
        }
      }
      await refresh();
    } catch (error) {
      setInviteError(errorMessage(error));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (
    member: OrganizationMember,
    role: "admin" | "member",
  ) => {
    setActionError("");
    setActiveActionId(member.userId);
    try {
      await updateOrganizationMemberRole(member.userId, organizationId, role);
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      window.dispatchEvent(new Event("stackit:boards-changed"));
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActiveActionId("");
    }
  };

  const handleBoardSelectionSave = async (member: OrganizationMember) => {
    setActionError("");
    setActiveActionId(member.userId);
    try {
      await updateOrganizationMemberBoards(
        member.userId,
        organizationId,
        boardSelections[member.userId] ?? [],
      );
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActiveActionId("");
    }
  };

  const handleInvitation = async (
    invitation: OrganizationInvitation,
    action: "accept" | "reject",
  ) => {
    setActionError("");
    setActiveActionId(invitation.id);
    try {
      if (action === "accept") {
        await acceptInvitation(invitation.id);
      } else {
        await rejectInvitation(invitation.id);
      }
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActiveActionId("");
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    setActionError("");
    setActiveActionId(member.userId);
    try {
      await removeOrganizationMember(member.userId, organizationId);
      setMemberToRemove(null);
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      window.dispatchEvent(new Event("stackit:boards-changed"));
      await refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setActiveActionId("");
    }
  };

  return (
    <div className="modal-backdrop centered-modal-backdrop" onClick={onClose}>
      <section
        className="centered-dialog members-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sidebar-form-header">
          <div>
            <h3 id="members-dialog-title">People</h3>
            <p>{organizationName}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close members dialog"
          >
            ×
          </button>
        </div>

        {loadErrors.map((error) => (
          <p className="form-error members-error" role="alert" key={error}>
            {error}
          </p>
        ))}
        {actionError && (
          <p className="form-error members-error" role="alert">
            {actionError}
          </p>
        )}
        {socketNotice && (
          <p className="form-error members-error" role="status">
            {socketNotice}
          </p>
        )}

        {canManage && (
          <>
            <section className="members-section">
              <h4>Invite to workspace</h4>
              <form className="member-invite-form" onSubmit={handleInvite}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  aria-label="Email address to invite"
                  required
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    isInviting || !email.trim() || selectedBoardIds.length === 0
                  }
                >
                  {isInviting ? "Sending..." : "Invite"}
                </button>
              </form>
              <fieldset className="board-access-options">
                <legend>Boards this member can access</legend>
                {boards.length === 0 ? (
                  <p className="members-empty">
                    Create a board before inviting a member.
                  </p>
                ) : (
                  boards.map((board) => (
                    <label key={board.id}>
                      <input
                        type="checkbox"
                        checked={selectedBoardIds.includes(board.id)}
                        onChange={(event) =>
                          setSelectedBoardIds((current) =>
                            event.target.checked
                              ? [...current, board.id]
                              : current.filter((id) => id !== board.id),
                          )
                        }
                      />
                      {board.title}
                    </label>
                  ))
                )}
              </fieldset>
              {inviteError && (
                <p className="form-error" role="alert">
                  {inviteError}
                </p>
              )}
              {successMessage && (
                <p className="member-success" role="status">
                  {successMessage}
                </p>
              )}
            </section>

            <section className="members-section">
              <h4>Workspace members</h4>
              {isLoading ? (
                <p className="members-empty" role="status">
                  Loading members...
                </p>
              ) : members.length === 0 ? (
                <p className="members-empty">No members to show.</p>
              ) : (
                <ul className="member-list">
                  {members.map((member) => {
                    const isSuperadmin = member.role === "superadmin";
                    const isCurrentUser = member.isCurrentUser;
                    const displayName =
                      member.user.name ||
                      member.user.email.split("@")[0] ||
                      member.user.email;
                    const selectedBoards = boardSelections[member.userId] ?? [];
                    const savedBoards = member.boardMemberships
                      .map((grant) => grant.board.id)
                      .sort();
                    const hasBoardChanges =
                      selectedBoards.slice().sort().join(",") !==
                      savedBoards.join(",");
                    return (
                      <li className="member-row" key={member.userId}>
                        <span
                          className="member-avatar"
                          style={{
                            background: getAvatarGradient(member.user.email),
                            color: "#ffffff",
                            fontWeight: 700,
                          }}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                        <span className="member-identity">
                          <strong>{displayName}</strong>
                          <span className="member-email">
                            {member.user.email}
                          </span>
                        </span>
                        {isSuperadmin || isCurrentUser ? (
                          <span className="member-role">
                            {isSuperadmin
                              ? "Superadmin"
                              : `You · ${member.role}`}
                          </span>
                        ) : (
                          <select
                            className="member-role-select"
                            aria-label={`Role for ${member.user.email}`}
                            value={member.role}
                            disabled={activeActionId === member.userId}
                            onChange={(event) =>
                              void handleRoleChange(
                                member,
                                event.target.value === "admin"
                                  ? "admin"
                                  : "member",
                              )
                            }
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        {!isSuperadmin &&
                          !isCurrentUser &&
                          (memberToRemove === member.userId ? (
                            <span className="member-confirm-actions">
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => setMemberToRemove(null)}
                                disabled={activeActionId === member.userId}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="text-button danger-text"
                                onClick={() => void handleRemoveMember(member)}
                                disabled={activeActionId === member.userId}
                              >
                                {activeActionId === member.userId
                                  ? "Removing..."
                                  : "Confirm"}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-button danger-text"
                              onClick={() => setMemberToRemove(member.userId)}
                            >
                              Remove
                            </button>
                          ))}
                        {canManage && member.role === "member" && (
                          <div className="member-board-access">
                            <fieldset className="board-access-options">
                              <legend>Board access</legend>
                              {boards.map((board) => (
                                <label key={board.id}>
                                  <input
                                    type="checkbox"
                                    checked={selectedBoards.includes(board.id)}
                                    onChange={(event) =>
                                      setBoardSelections((current) => {
                                        const currentIds =
                                          current[member.userId] ?? [];
                                        return {
                                          ...current,
                                          [member.userId]: event.target.checked
                                            ? [...currentIds, board.id]
                                            : currentIds.filter(
                                                (id) => id !== board.id,
                                              ),
                                        };
                                      })
                                    }
                                  />
                                  {board.title}
                                </label>
                              ))}
                            </fieldset>
                            {hasBoardChanges && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  void handleBoardSelectionSave(member)
                                }
                                disabled={activeActionId === member.userId}
                              >
                                Save board access
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="members-section">
              <h4>
                Workspace invitations{" "}
                {!isLoading && `(${organizationInvitations.length})`}
              </h4>
              {organizationInvitations.length === 0 ? (
                <p className="members-empty">No workspace invitations.</p>
              ) : (
                <ul className="member-list">
                  {organizationInvitations.map((invitation) => (
                    <li className="member-row" key={invitation.id}>
                      <span className="member-email">{invitation.email}</span>
                      <span className="member-role">
                        {invitation.status === "FAILED"
                          ? "Email failed"
                          : invitation.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="members-section">
          <h4>Invitations for you</h4>
          {pendingInvitations.length === 0 ? (
            <p className="members-empty">No invitations waiting for you.</p>
          ) : (
            <ul className="member-list">
              {pendingInvitations.map((invitation) => (
                <li className="incoming-invitation" key={invitation.id}>
                  <div>
                    <strong>{invitation.org?.name ?? "A workspace"}</strong>
                    <span>
                      Invited as {invitation.role}
                      {invitation.inviter?.email
                        ? ` by ${invitation.inviter.email}`
                        : ""}
                    </span>
                    {invitation.boards && invitation.boards.length > 0 && (
                      <span>
                        Boards:{" "}
                        {invitation.boards
                          .map((grant) => grant.board.title)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="member-confirm-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        void handleInvitation(invitation, "reject")
                      }
                      disabled={activeActionId === invitation.id}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        void handleInvitation(invitation, "accept")
                      }
                      disabled={activeActionId === invitation.id}
                    >
                      {activeActionId === invitation.id
                        ? "Working..."
                        : "Accept"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed.";
}
