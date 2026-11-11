const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/v1";

export type ApiError = {
  message: string;
  status: number;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  raw?: boolean;
};

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, raw, ...rest } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      message = payload.error?.message ?? payload.message ?? message;
    } catch {
      /* ignore */
    }
    const error: ApiError = { message, status: response.status };
    throw error;
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (raw || contentType.includes("text/csv")) {
    return (await response.text()) as T;
  }
  const json = await response.json();
  return unwrap<T>(json);
}

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const origin = API_URL.replace(/\/v1\/?$/, "");
  return `${origin}${path}`;
}

export { API_URL };
