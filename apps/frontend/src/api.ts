const API_URL = import.meta.env?.BUN_PUBLIC_API_URL ?? "http://localhost:3000";

export type ApiResponse = {
  success: boolean;
  data?: string;
  msg?: string;
  error?: string;
};

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = (await response.json()) as ApiResponse;
  if (!response.ok || !body.success) {
    throw new Error(body.error ?? "Something went wrong");
  }

  return body;
}

export function signup(data: {
  email: string;
  password: string;
  profile: string;
  description: string;
}) {
  return request("/api/v1/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function signin(data: { email: string; password: string }) {
  return request("/api/v1/signin", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
