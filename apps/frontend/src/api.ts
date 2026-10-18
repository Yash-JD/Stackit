const API_URL = import.meta.env?.BUN_PUBLIC_API_URL ?? "http://localhost:3000";
export const AUTH_TOKEN_KEY = "stackit_token";

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
  boardId: string;
  sectionId: string;
  isDeleted: boolean;
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
  const { authenticated = false, headers: requestHeaders, ...requestOptions } =
    options;
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

export async function getOrganizations() {
  const response = await apiRequest<{
    membership: Array<{ organization: Organization }>;
  }>("/api/v1/organization", { authenticated: true });
  const memberships = response.data?.membership;

  if (!Array.isArray(memberships)) {
    throw new Error("The server returned an invalid organizations response");
  }

  return memberships
    .map((membership) => membership.organization)
    .filter((organization) => organization && !organization.isDeleted);
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

  return response.data;
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

export async function createIssue(sectionId: string, title: string, description: string) {
  const response = await apiRequest<IssueSummary>(`/api/v1/issue/${sectionId}`, {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ title, description }),
  });

  if (!response.data) {
    throw new Error("The server did not create the issue");
  }

  return response.data;
}

export async function updateIssue(issueId: string, title: string, description: string) {
  const response = await apiRequest<IssueSummary>(`/api/v1/issue/${issueId}`, {
    method: "PUT",
    authenticated: true,
    body: JSON.stringify({ title, description }),
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

export async function moveIssue(issueId: string, sectionId: string) {
  const response = await apiRequest<IssueSummary>(
    `/api/v1/issue/move/${encodeURIComponent(issueId)}/${encodeURIComponent(sectionId)}`,
    {
      method: "PUT",
      authenticated: true,
    },
  );

  if (!response.data) {
    throw new Error("The server did not move the issue");
  }

  return response.data;
}
