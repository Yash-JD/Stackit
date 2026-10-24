import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Mail,
  Menu,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useOutletContext } from "react-router";
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
} from "../api";
import type { WorkspaceLayoutContext } from "../types";

const WEBSOCKET_URL =
  import.meta.env?.BUN_PUBLIC_WS_URL ?? "ws://localhost:8080";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

export function MembersPage() {
  const {
    toggleSidebar,
    workspaces,
    selectedOrgId,
    isLoading: isWorkspaceLoading,
    error: workspaceError,
  } = useOutletContext<WorkspaceLayoutContext>();

  const selectedWorkspace =
    workspaces.find(({ organization }) => organization.id === selectedOrgId) ??
    workspaces[0];

  const organizationId = selectedWorkspace?.organization.id ?? "";
  const organizationName = selectedWorkspace?.organization.name ?? "Workspace";
  const boards = selectedWorkspace?.boards ?? [];
  const membershipRole = selectedWorkspace?.organization.membershipRole;
  const isSuperadmin = membershipRole === "superadmin";
  const isAdmin = membershipRole === "admin";
  const canManageBoardGrants = isSuperadmin || isAdmin;

  const [activeTab, setActiveTab] = useState<"members" | "invites" | "incoming">("members");
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [organizationInvitations, setOrganizationInvitations] = useState<
    OrganizationInvitation[]
  >([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    OrganizationInvitation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Invite state
  const [email, setEmail] = useState("");
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Member management state
  const [actionError, setActionError] = useState("");
  const [activeActionId, setActiveActionId] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [boardSelections, setBoardSelections] = useState<Record<string, string[]>>({});
  const [expandedBoardMemberId, setExpandedBoardMemberId] = useState<string | null>(null);

  // WebSocket
  const [socketNotice, setSocketNotice] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const joinedOrganizationRef = useRef(false);
  const failedInvitationIdsRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadErrors([]);

    const [membersResult, orgInvitesResult, pendingResult] =
      await Promise.allSettled([
        canManageBoardGrants
          ? getOrganizationMembers(organizationId)
          : Promise.resolve([]),
        isSuperadmin
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

    if (orgInvitesResult.status === "fulfilled") {
      setOrganizationInvitations(orgInvitesResult.value);
    } else {
      setOrganizationInvitations([]);
      errors.push(`Workspace invitations: ${errorMessage(orgInvitesResult.reason)}`);
    }

    if (pendingResult.status === "fulfilled") {
      setPendingInvitations(pendingResult.value);
    } else {
      setPendingInvitations([]);
      errors.push(`Invitations for you: ${errorMessage(pendingResult.reason)}`);
    }

    setLoadErrors(errors);
    setIsLoading(false);
  }, [canManageBoardGrants, isSuperadmin, organizationId]);

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

  // WebSocket subscription for live invite notifications
  useEffect(() => {
    if (!isSuperadmin || !organizationId) return;
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

      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }

      if (message.type === "joined_organization") {
        joinedOrganizationRef.current = true;
        for (const failedInvitationId of failedInvitationIdsRef.current) {
          socket.send(
            JSON.stringify({
              type: "invitation_failed",
              invitationId: failedInvitationId,
              organizationId,
            }),
          );
        }
        failedInvitationIdsRef.current = [];
        return;
      }

      if (
        message.type === "invitation_accepted" ||
        message.type === "invitation_rejected" ||
        message.type === "invitation_failed"
      ) {
        if (
          "email" in message &&
          typeof message.email === "string" &&
          "status" in message &&
          typeof message.status === "string"
        ) {
          const actionText =
            message.status === "ACCEPTED"
              ? "joined the workspace"
              : message.status === "REJECTED"
                ? "declined the invitation"
                : "failed to receive the invitation";
          setSocketNotice(`${message.email} has ${actionText}.`);
        }
        void refresh();
      }
    });

    return () => {
      joinedOrganizationRef.current = false;
      failedInvitationIdsRef.current = [];
      if (socketRef.current === socket) socketRef.current = null;
      socket.close();
    };
  }, [isSuperadmin, organizationId, refresh]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const inviteEmail = email.trim().toLowerCase();
    if (!inviteEmail || selectedBoardIds.length === 0 || !organizationId) return;

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
        setSuccessMessage(`Invitation successfully sent to ${inviteEmail}.`);
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
    } catch (err) {
      setInviteError(errorMessage(err));
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
    } catch (err) {
      setActionError(errorMessage(err));
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
      setExpandedBoardMemberId(null);
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId("");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setActionError("");
    setActiveActionId(memberToRemove.userId);
    try {
      await removeOrganizationMember(memberToRemove.userId, organizationId);
      setMemberToRemove(null);
      window.dispatchEvent(new Event("stackit:organizations-changed"));
      window.dispatchEvent(new Event("stackit:boards-changed"));
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
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
      window.dispatchEvent(new Event("stackit:boards-changed"));
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActiveActionId("");
    }
  };

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const name = (member.user.name ?? "").toLowerCase();
    const memberEmail = member.user.email.toLowerCase();
    return name.includes(query) || memberEmail.includes(query);
  });

  return (
    <main className="board-shell workspace-home members-page">
      <header className="workspace-home-header">
        <button
          className="icon-button mobile-menu"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={19} />
        </button>
        <div>
          <p className="eyebrow">WORKSPACES / MEMBERS</p>
          <h1>Members & Access</h1>
          <p>
            Manage team members, roles, board access permissions, and invites for{" "}
            <strong>{organizationName}</strong>.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button refresh-btn"
          onClick={() => void refresh()}
          disabled={isLoading}
          title="Refresh member list"
        >
          <RefreshCw size={15} className={isLoading ? "spin" : ""} />
          <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </header>

      {/* Global Alerts / Notices */}
      {loadErrors.map((err) => (
        <div key={err} className="form-alert form-alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{err}</span>
        </div>
      ))}

      {actionError && (
        <div className="form-alert form-alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {socketNotice && (
        <div className="form-alert form-alert-info" role="status">
          <Clock size={16} />
          <span>{socketNotice}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="members-tabs">
        <button
          type="button"
          className={`members-tab ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          <Users size={16} />
          <span>Team Members</span>
          <span className="tab-count">{members.length}</span>
        </button>

        {isSuperadmin && (
          <button
            type="button"
            className={`members-tab ${activeTab === "invites" ? "active" : ""}`}
            onClick={() => setActiveTab("invites")}
          >
            <Mail size={16} />
            <span>Workspace Invites</span>
            <span className="tab-count">{organizationInvitations.length}</span>
          </button>
        )}

        {pendingInvitations.length > 0 && (
          <button
            type="button"
            className={`members-tab ${activeTab === "incoming" ? "active" : ""}`}
            onClick={() => setActiveTab("incoming")}
          >
            <UserPlus size={16} />
            <span>Invitations for You</span>
            <span className="tab-count alert-count">{pendingInvitations.length}</span>
          </button>
        )}
      </div>

      {/* Tab Content: Team Members */}
      {activeTab === "members" && (
        <div className="members-tab-content">
          {/* Invite Section (Superadmin only) */}
          {isSuperadmin && (
            <section className="members-card invite-card" aria-label="Invite member">
              <div className="members-card-header">
                <div>
                  <h3>Invite a New Member</h3>
                  <p>Send an invitation to join {organizationName} with access to selected boards.</p>
                </div>
              </div>

              <form className="member-invite-fullform" onSubmit={handleInvite}>
                <div className="invite-inputs-row">
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      aria-label="Email address to invite"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="primary-button invite-submit-btn"
                    disabled={isInviting || !email.trim() || selectedBoardIds.length === 0}
                  >
                    <UserPlus size={16} />
                    <span>{isInviting ? "Sending..." : "Send Invite"}</span>
                  </button>
                </div>

                <div className="invite-boards-section">
                  <span className="section-subtitle">Grant access to boards (required):</span>
                  {boards.length === 0 ? (
                    <p className="no-boards-notice">
                      No boards in this workspace. Create a board first before inviting teammates.
                    </p>
                  ) : (
                    <div className="boards-checklist">
                      {boards.map((board) => (
                        <label key={board.id} className="board-check-item">
                          <input
                            type="checkbox"
                            checked={selectedBoardIds.includes(board.id)}
                            onChange={(e) =>
                              setSelectedBoardIds((cur) =>
                                e.target.checked
                                  ? [...cur, board.id]
                                  : cur.filter((id) => id !== board.id),
                              )
                            }
                          />
                          <span>{board.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {inviteError && (
                  <div className="form-alert form-alert-error" role="alert">
                    <AlertCircle size={15} />
                    <span>{inviteError}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="form-alert form-alert-success" role="status">
                    <CheckCircle2 size={15} />
                    <span>{successMessage}</span>
                  </div>
                )}
              </form>
            </section>
          )}

          {/* Members List Section */}
          <section className="members-card members-list-card" aria-label="Members List">
            <div className="members-card-header members-filter-header">
              <div>
                <h3>Workspace Members ({filteredMembers.length})</h3>
                <p>Everyone currently in this workspace and their permission levels.</p>
              </div>
              <div className="members-search-box">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="members-loading-state">
                <RefreshCw size={24} className="spin" />
                <p>Loading members...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="members-empty-state">
                <Users size={32} />
                <p>No members found matching your search.</p>
              </div>
            ) : (
              <div className="members-table-wrapper">
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Board Access</th>
                      {isSuperadmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const isSuperadminMember = member.role === "superadmin";
                      const isAdminMember = member.role === "admin";
                      const isCurrentUser = member.isCurrentUser;
                      const displayName =
                        member.user.name ||
                        member.user.email.split("@")[0] ||
                        member.user.email;
                      const selectedBoards = boardSelections[member.userId] ?? [];
                      const savedBoards = member.boardMemberships
                        .map((g) => g.board.id)
                        .sort();
                      const hasBoardChanges =
                        selectedBoards.slice().sort().join(",") !== savedBoards.join(",");
                      const isEditingBoards = expandedBoardMemberId === member.userId;

                      return (
                        <tr key={member.userId} className="member-table-row">
                          <td className="member-user-cell">
                            <div className="member-avatar">
                              {member.user.profilePhoto ? (
                                <img
                                  src={member.user.profilePhoto}
                                  alt={displayName}
                                  className="avatar-img"
                                />
                              ) : (
                                displayName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="member-user-info">
                              <span className="member-name">
                                {displayName}
                                {isCurrentUser && <span className="you-badge">You</span>}
                              </span>
                              <span className="member-email-text">{member.user.email}</span>
                            </div>
                          </td>

                          <td className="member-role-cell">
                            {isSuperadmin && !isCurrentUser && !isSuperadminMember ? (
                              <select
                                className="member-role-select"
                                value={member.role}
                                disabled={activeActionId === member.userId}
                                onChange={(e) =>
                                  void handleRoleChange(
                                    member,
                                    e.target.value === "admin" ? "admin" : "member",
                                  )
                                }
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                            ) : (
                              <span
                                className={`role-badge ${
                                  isSuperadminMember
                                    ? "role-superadmin"
                                    : `role-${member.role}`
                                }`}
                              >
                                <Shield size={12} />
                                {isSuperadminMember ? "Superadmin" : member.role}
                              </span>
                            )}
                          </td>

                          <td className="member-boards-cell">
                            {/* Superadmin & Admin automatically have access to all boards */}
                            {isSuperadminMember ? (
                              <div className="board-access-fixed">
                                <span className="all-boards-pill">All Boards Access</span>
                                <span className="board-access-note">
                                  Superadmins automatically have access to all boards.
                                </span>
                              </div>
                            ) : isAdminMember ? (
                              <div className="board-access-fixed">
                                <span className="all-boards-pill">All Boards Access</span>
                                <span className="board-access-note">
                                  Admins automatically have access to all boards.
                                </span>
                              </div>
                            ) : isCurrentUser ? (
                              /* Current user cannot modify their own board access */
                              <div className="board-access-fixed">
                                <div className="board-tags">
                                  {member.boardMemberships.map((grant) => (
                                    <span key={grant.board.id} className="board-tag">
                                      {grant.board.title}
                                    </span>
                                  ))}
                                  {member.boardMemberships.length === 0 && (
                                    <span className="no-access-text">No board grants</span>
                                  )}
                                </div>
                                <span className="board-access-note">
                                  You cannot modify your own board access.
                                </span>
                              </div>
                            ) : isEditingBoards && canManageBoardGrants ? (
                              /* Admin / Superadmin editing regular member boards */
                              <div className="member-board-editor">
                                <div className="board-check-grid">
                                  {boards.map((b) => (
                                    <label key={b.id} className="board-check-pill">
                                      <input
                                        type="checkbox"
                                        checked={selectedBoards.includes(b.id)}
                                        onChange={(e) =>
                                          setBoardSelections((cur) => ({
                                            ...cur,
                                            [member.userId]: e.target.checked
                                              ? [...(cur[member.userId] ?? []), b.id]
                                              : (cur[member.userId] ?? []).filter(
                                                  (id) => id !== b.id,
                                                ),
                                          }))
                                        }
                                      />
                                      <span>{b.title}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="board-editor-actions">
                                  <button
                                    type="button"
                                    className="primary-button btn-xs"
                                    disabled={!hasBoardChanges || activeActionId === member.userId}
                                    onClick={() => void handleBoardSelectionSave(member)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button btn-xs"
                                    onClick={() => {
                                      setBoardSelections((cur) => ({
                                        ...cur,
                                        [member.userId]: savedBoards,
                                      }));
                                      setExpandedBoardMemberId(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Regular view for member board grants */
                              <div className="member-boards-preview">
                                {member.boardMemberships.length === 0 ? (
                                  <span className="no-access-text">No board grants</span>
                                ) : (
                                  <div className="board-tags">
                                    {member.boardMemberships.map((grant) => (
                                      <span key={grant.board.id} className="board-tag">
                                        {grant.board.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {canManageBoardGrants && boards.length > 0 && (
                                  <button
                                    type="button"
                                    className="edit-boards-btn"
                                    onClick={() => setExpandedBoardMemberId(member.userId)}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {isSuperadmin && (
                            <td className="member-actions-cell">
                              {!isSuperadminMember && !isCurrentUser && (
                                <button
                                  type="button"
                                  className="icon-danger-btn"
                                  title="Remove from workspace"
                                  onClick={() => setMemberToRemove(member)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab Content: Outgoing Workspace Invitations (Superadmin only) */}
      {activeTab === "invites" && isSuperadmin && (
        <section className="members-card" aria-label="Workspace Invitations">
          <div className="members-card-header">
            <div>
              <h3>Workspace Invitations ({organizationInvitations.length})</h3>
              <p>People who have been invited to this workspace and haven't accepted yet.</p>
            </div>
          </div>

          {organizationInvitations.length === 0 ? (
            <div className="members-empty-state">
              <Mail size={32} />
              <p>No pending invitations for {organizationName}.</p>
            </div>
          ) : (
            <div className="invitations-list">
              {organizationInvitations.map((inv) => (
                <div key={inv.id} className="invitation-item-card">
                  <div className="invitation-info">
                    <span className="invitation-email">
                      <Mail size={15} />
                      <strong>{inv.email}</strong>
                    </span>
                    <span className="invitation-meta">
                      Invited on {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                    {inv.boards && inv.boards.length > 0 && (
                      <div className="board-tags">
                        {inv.boards.map((b) => (
                          <span key={b.board.id} className="board-tag">
                            {b.board.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="invitation-status-badge">
                    <span className={`status-pill status-${inv.status.toLowerCase()}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab Content: Incoming Invitations for current user */}
      {activeTab === "incoming" && (
        <section className="members-card" aria-label="Invitations for you">
          <div className="members-card-header">
            <div>
              <h3>Invitations for You ({pendingInvitations.length})</h3>
              <p>You have been invited to collaborate in these workspaces.</p>
            </div>
          </div>

          {pendingInvitations.length === 0 ? (
            <div className="members-empty-state">
              <CheckCircle2 size={32} />
              <p>You have no pending invitations to any workspaces.</p>
            </div>
          ) : (
            <div className="incoming-invites-grid">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="incoming-invite-card">
                  <div className="invite-card-top">
                    <h4>{inv.org?.name ?? "Unnamed Workspace"}</h4>
                    <span className="inviter-text">
                      Invited by: {inv.inviter?.email ?? "Team admin"}
                    </span>
                  </div>
                  {inv.boards && inv.boards.length > 0 && (
                    <div className="invite-boards-list">
                      <span>Access to boards:</span>
                      <div className="board-tags">
                        {inv.boards.map((b) => (
                          <span key={b.board.id} className="board-tag">
                            {b.board.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="invite-card-actions">
                    <button
                      type="button"
                      className="primary-button btn-sm"
                      disabled={activeActionId === inv.id}
                      onClick={() => void handleInvitation(inv, "accept")}
                    >
                      <Check size={14} />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button btn-sm danger-btn"
                      disabled={activeActionId === inv.id}
                      onClick={() => void handleInvitation(inv, "reject")}
                    >
                      <X size={14} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Confirmation Modal for Removing Member */}
      {memberToRemove && (
        <div
          className="modal-backdrop centered-modal-backdrop"
          onClick={() => setMemberToRemove(null)}
        >
          <div
            className="centered-dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon-danger">
              <AlertCircle size={28} />
            </div>
            <h3>Remove Member</h3>
            <p>
              Are you sure you want to remove{" "}
              <strong>
                {memberToRemove.user.name || memberToRemove.user.email}
              </strong>{" "}
              from <strong>{organizationName}</strong>? They will lose access to all
              boards and tasks in this workspace.
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMemberToRemove(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-btn"
                disabled={activeActionId === memberToRemove.userId}
                onClick={() => void handleRemoveMember()}
              >
                {activeActionId === memberToRemove.userId
                  ? "Removing..."
                  : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
export default MembersPage;
