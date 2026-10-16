const API_URL = import.meta.env?.BUN_PUBLIC_API_URL ?? "http://localhost:3000";
export const AUTH_TOKEN_KEY = "stackit_token";

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  msg?: string;
  error?: string;
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
