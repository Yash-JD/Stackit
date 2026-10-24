const API_URL = import.meta.env?.BUN_PUBLIC_API_URL ?? "http://localhost:3000";
const WEBSOCKET_URL =
  import.meta.env?.BUN_PUBLIC_WS_URL ?? "ws://localhost:8080";
export const AUTH_TOKEN_KEY = "stackit_token";

export function notifyBoardSocket(
  boardId: string,
  type: "board_changed" | "board_deleted",
) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    console.warn("Cannot notify board viewers without an active login.");
    return;
  }

  let socket: WebSocket;
  try {
    socket = new WebSocket(
      `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`,
    );
  } catch (error) {
    console.error("Unable to notify board viewers:", error);
    return;
  }

  let eventSent = false;
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    console.warn("Timed out notifying board viewers.");
    socket.close();
  }, 5_000);
  socket.onopen = () => {
    try {
      socket.send(JSON.stringify({ type, boardId }));
    } catch (error) {
      console.error("Unable to notify board viewers:", error);
      socket.close();
    }
  };
  socket.onmessage = (event) => {
    try {
      const message: unknown = JSON.parse(String(event.data));
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "board_event_sent"
      ) {
        eventSent = true;
        socket.close();
      }
    } catch (error) {
      console.error("Unable to read board notification response:", error);
    }
  };
  socket.onerror = (error) => {
    console.error("Unable to notify board viewers:", error);
    socket.close();
  };
  socket.onclose = () => {
    window.clearTimeout(timeout);
    if (!eventSent && !didTimeout) {
      console.warn("The board notification was not confirmed by the server.");
    }
  };
}

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  msg?: string;
  error?: string;
};

export type Organization = {
  id: string;
  name: string;
  description: string;
  isDeleted: boolean;
  membershipRole?: "superadmin" | "admin" | "member";
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  profilePhoto: string | null;
  description: string;
};

export type BoardSummary = {
  id: string;
  title: string;
  orgId: string;
};

export type SectionSummary = {
  id: string;
  title: string;
  boardId: string;
  isDeleted: boolean;
};

export type IssueSummary = {
  id: string;
  title: string;
  description: string;
  label: "Design" | "Build" | "Research";
  dueDate: string | null;
  boardId: string;
  sectionId: string;
  position: number;
  isDeleted: boolean;
};

export type IssueComment = {
  id: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  isAuthor: boolean;
  user: {
    id: string;
    email: string;
    profilePhoto: string | null;
  } | null;
};

export type IssueActivity = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    name?: string | null;
    profilePhoto: string | null;
  } | null;
  issue?: {
    id: string;
    title: string;
    boardId?: string;
    board?: {
      id: string;
      title: string;
    };
  };
};

export type OrganizationMember = {
  userId: string;
  orgId: string;
  isCurrentUser: boolean;
  role: "superadmin" | "admin" | "member";
  user: {
    id: string;
    email: string;
    name: string | null;
    profilePhoto: string | null;
  };
  boardMemberships: Array<{
    board: { id: string; title: string };
  }>;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  orgId: string;
  role: "member";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "FAILED";
  createdAt: string;
  org?: { id: string; name: string };
  inviter?: { email: string };
  boards?: Array<{ board: { id: string; title: string } }>;
};

type ApiRequestOptions = RequestInit & {
  authenticated?: boolean;
};

function isApiResponse(body: unknown): body is ApiResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "success" in body &&
    typeof body.success === "boolean" &&
    (!("msg" in body) || typeof body.msg === "string") &&
    (!("error" in body) || typeof body.error === "string")
  );
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    authenticated = false,
    headers: requestHeaders,
    ...requestOptions
  } = options;
  const headers = new Headers(requestHeaders);
  const isFormData =
    typeof FormData !== "undefined" && requestOptions.body instanceof FormData;

  if (requestOptions.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) throw new Error("Authentication is required for this request");
    headers.set("Authorization", token);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers,
  });

  const responseText = await response.text();
  let body: unknown;

  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(
        response.ok
          ? "The server returned an invalid response"
          : `Request failed with status ${response.status}`,
      );
    }
  }

  if (!isApiResponse(body)) {
    throw new Error(
      response.ok
        ? "The server returned an invalid response"
        : `Request failed with status ${response.status}`,
    );
  }

  if (!response.ok || !body.success) {
    throw new Error(
      body.error ?? body.msg ?? `Request failed with status ${response.status}`,
    );
  }

  return body as ApiResponse<T>;
}

export function signup(data: {
  email: string;
  password: string;
  name: string;
  profile: string;
  description: string;
}) {
  return apiRequest("/api/v1/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function signin(data: { email: string; password: string }) {
  return apiRequest<string>("/api/v1/signin", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProfile() {
  const response = await apiRequest<UserProfile>("/api/v1/profile", {
    authenticated: true,
  });
  if (!response.data) {
    throw new Error("The server did not return your profile");
  }
  return response.data;
}

export async function updateProfile(data: {
  name: string;
  profilePhoto: string;
  description: string;
}) {
  const response = await apiRequest<UserProfile>("/api/v1/profile", {
    method: "PUT",
    authenticated: true,
    body: JSON.stringify(data),
  });
  if (!response.data) {
    throw new Error("The server did not return your updated profile");
  }
  return response.data;
}

export async function getOrganizations() {
  const response = await apiRequest<{
    membership: Array<{
      organization: Organization;
      role: Organization["membershipRole"];
    }>;
  }>("/api/v1/organization", { authenticated: true });
  const memberships = response.data?.membership;

  if (!Array.isArray(memberships)) {
    throw new Error("The server returned an invalid organizations response");
  }

  return memberships
    .map((membership) => ({
      ...membership.organization,
      membershipRole: membership.role,
    }))
    .filter((organization) => organization && !organization.isDeleted);
}

export async function getOrganizationMembers(orgId: string) {
  const response = await apiRequest<{
    membership: OrganizationMember[];
  }>(`/api/v1/membership/${encodeURIComponent(orgId)}`, {
    authenticated: true,
  });
  const members = response.data?.membership;

  if (!Array.isArray(members)) {
    throw new Error("The server returned an invalid members response");
  }

  return members.map((member) => ({
    ...member,
    boardMemberships: member.boardMemberships ?? [],
  }));
}

export async function getOrganizationInvitations(orgId: string) {
  const response = await apiRequest<{
    invitations: OrganizationInvitation[];
  }>(`/api/v1/invitation/organization/${encodeURIComponent(orgId)}`, {
    authenticated: true,
  });
  const invitations = response.data?.invitations;

  if (!Array.isArray(invitations)) {
    throw new Error("The server returned an invalid invitations response");
  }

  return invitations;
}

export async function getPendingInvitations() {
  const response = await apiRequest<{
    invitations: OrganizationInvitation[];
  }>("/api/v1/invitation/pending", { authenticated: true });
  const invitations = response.data?.invitations;

  if (!Array.isArray(invitations)) {
    throw new Error("The server returned an invalid invitations response");
  }

  return invitations;
}

export async function inviteOrganizationMember(
  orgId: string,
  email: string,
  boardIds: string[],
) {
  const response = await apiRequest<{
    invitationId: string;
    emailSent: boolean;
  }>("/api/v1/invite", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ orgId, email, boardIds }),
  });

  if (
    !response.data ||
    typeof response.data.invitationId !== "string" ||
    typeof response.data.emailSent !== "boolean"
  ) {
    throw new Error("The server returned an invalid invitation response");
  }

  return response.data;
}

export async function acceptInvitation(invitationId: string) {
  await apiRequest(`/api/v1/accept/${encodeURIComponent(invitationId)}`, {
    method: "POST",
    authenticated: true,
  });
}

export async function rejectInvitation(invitationId: string) {
  await apiRequest(`/api/v1/reject/${encodeURIComponent(invitationId)}`, {
    method: "POST",
    authenticated: true,
  });
}

export async function removeOrganizationMember(userId: string, orgId: string) {
  await apiRequest(
    `/api/v1/membership/${encodeURIComponent(userId)}/${encodeURIComponent(orgId)}`,
    { method: "DELETE", authenticated: true },
  );
}

export async function updateOrganizationMemberRole(
  userId: string,
  orgId: string,
  role: "admin" | "member",
) {
  await apiRequest(
    `/api/v1/membership/${encodeURIComponent(userId)}/${encodeURIComponent(orgId)}/role`,
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({ role }),
    },
  );
}

export async function updateOrganizationMemberBoards(
  userId: string,
  orgId: string,
  boardIds: string[],
) {
  await apiRequest(
    `/api/v1/membership/${encodeURIComponent(userId)}/${encodeURIComponent(orgId)}/boards`,
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({ boardIds }),
    },
  );
}

export async function createOrganization(
  name: string,
  description = "Workspace for our team",
) {
  const response = await apiRequest<Organization>(
    "/api/v1/organization/create",
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({ name, description }),
    },
  );

  if (!response.data) {
    throw new Error("The server did not create the organization");
  }

  return { ...response.data, membershipRole: "superadmin" as const };
}

export async function updateOrganization(
  organizationId: string,
  name: string,
  description: string,
) {
  const response = await apiRequest<Organization>(
    `/api/v1/organization/${encodeURIComponent(organizationId)}`,
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({ name, description }),
    },
  );

  if (!response.data) {
    throw new Error("The server did not update the organization");
  }

  return response.data;
}

export async function deleteOrganization(organizationId: string) {
  await apiRequest(
    `/api/v1/organization/${encodeURIComponent(organizationId)}`,
    {
      method: "DELETE",
      authenticated: true,
    },
  );
}

export async function getBoards(orgId: string) {
  const response = await apiRequest<{ board: BoardSummary[] }>(
    `/api/v1/boards?orgId=${encodeURIComponent(orgId)}`,
    { authenticated: true },
  );
  const boards = response.data?.board;

  if (!Array.isArray(boards)) {
    throw new Error("The server returned an invalid boards response");
  }

  return boards;
}

export async function createBoard(orgId: string, title: string) {
  const response = await apiRequest<BoardSummary>("/api/v1/boards", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ orgId, title }),
  });

  if (!response.data) {
    throw new Error("The server did not create the board");
  }

  return response.data;
}

export async function renameBoard(boardId: string, title: string) {
  const response = await apiRequest<BoardSummary>(`/api/v1/boards/${boardId}`, {
    method: "PUT",
    authenticated: true,
    body: JSON.stringify({ title }),
  });

  if (!response.data) {
    throw new Error("The server did not rename the board");
  }

  return response.data;
}

export async function deleteBoard(boardId: string) {
  await apiRequest(`/api/v1/boards/${boardId}`, {
    method: "DELETE",
    authenticated: true,
  });
}

export async function getBoardSections(orgId: string) {
  const response = await apiRequest<
    Array<{
      id: string;
      title: string;
      orgId: string;
      sections: SectionSummary[];
    }>
  >(`/api/v1/section?orgId=${encodeURIComponent(orgId)}`, {
    authenticated: true,
  });
  const boards = response.data;

  if (!Array.isArray(boards)) {
    throw new Error("The server returned an invalid sections response");
  }

  return boards;
}

export async function createSection(boardId: string, title: string) {
  const response = await apiRequest<SectionSummary>("/api/v1/section", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ boardId, title }),
  });

  if (!response.data) {
    throw new Error("The server did not create the section");
  }

  return response.data;
}

export async function getIssuesForSection(sectionId: string) {
  const response = await apiRequest<IssueSummary[]>(
    `/api/v1/issue/${encodeURIComponent(sectionId)}`,
    { authenticated: true },
  );
  const issues = response.data;

  if (!Array.isArray(issues)) {
    throw new Error("The server returned an invalid issues response");
  }

  return issues;
}

export async function createIssue(
  sectionId: string,
  title: string,
  description: string,
  label: IssueSummary["label"],
  dueDate: string | null,
) {
  const response = await apiRequest<IssueSummary>(
    `/api/v1/issue/${sectionId}`,
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({ title, description, label, dueDate }),
    },
  );

  if (!response.data) {
    throw new Error("The server did not create the issue");
  }

  return response.data;
}

export async function updateIssue(
  issueId: string,
  title: string,
  description: string,
  label: IssueSummary["label"],
  dueDate: string | null,
) {
  const response = await apiRequest<IssueSummary>(`/api/v1/issue/${issueId}`, {
    method: "PUT",
    authenticated: true,
    body: JSON.stringify({ title, description, label, dueDate }),
  });

  if (!response.data) {
    throw new Error("The server did not update the issue");
  }

  return response.data;
}

export async function deleteIssue(issueId: string) {
  await apiRequest(`/api/v1/issue/${issueId}`, {
    method: "DELETE",
    authenticated: true,
  });
}

export type CardDetailResponse = IssueSummary & {
  section?: {
    id: string;
    title: string;
  };
  board?: {
    id: string;
    title: string;
    orgId: string;
  };
};

export async function getIssue(issueId: string): Promise<CardDetailResponse> {
  const response = await apiRequest<CardDetailResponse>(
    `/api/v1/issue/detail/${encodeURIComponent(issueId)}`,
    { authenticated: true },
  );
  if (!response.data) {
    throw new Error(response.error || "The card could not be found");
  }
  return response.data;
}

export async function moveIssue(
  issueId: string,
  sectionId: string,
  position: number,
) {
  const response = await apiRequest<IssueSummary>(
    `/api/v1/issue/move/${encodeURIComponent(issueId)}/${encodeURIComponent(sectionId)}`,
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({ position }),
    },
  );

  if (!response.data) {
    throw new Error("The server did not move the issue");
  }

  return response.data;
}

export async function getIssueComments(issueId: string) {
  const response = await apiRequest<IssueComment[]>(
    `/api/v1/comment/${encodeURIComponent(issueId)}`,
    { authenticated: true },
  );
  if (!Array.isArray(response.data)) {
    throw new Error("The server returned an invalid comments response");
  }
  return response.data;
}

export async function createIssueComment(issueId: string, comment: string) {
  const response = await apiRequest<IssueComment>(
    `/api/v1/comment/${encodeURIComponent(issueId)}`,
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({ comment }),
    },
  );
  if (!response.data) throw new Error("The server did not create the comment");
  return response.data;
}

export async function updateIssueComment(commentId: string, comment: string) {
  await apiRequest(`/api/v1/comment/${encodeURIComponent(commentId)}`, {
    method: "PUT",
    authenticated: true,
    body: JSON.stringify({ comment }),
  });
}

export async function deleteIssueComment(commentId: string) {
  await apiRequest(`/api/v1/comment/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
    authenticated: true,
  });
}

export async function getIssueActivity(issueId: string) {
  const response = await apiRequest<{ activities: IssueActivity[] }>(
    `/api/v1/activity/${encodeURIComponent(issueId)}`,
    { authenticated: true },
  );
  if (!Array.isArray(response.data?.activities)) {
    throw new Error("The server returned an invalid activity response");
  }
  return response.data.activities;
}

export async function getOrganizationActivity(orgId: string) {
  const response = await apiRequest<{ activities: IssueActivity[] }>(
    `/api/v1/organization/${encodeURIComponent(orgId)}/activity`,
    { authenticated: true },
  );
  if (!Array.isArray(response.data?.activities)) {
    throw new Error("The server returned an invalid activity response");
  }
  return response.data.activities;
}
