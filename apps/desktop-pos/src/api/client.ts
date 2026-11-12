/** Same-origin `/v1` on Vercel; localhost for local API. Override with VITE_API_URL. */
const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "/v1" : "http://localhost:3001/v1");

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function apiRequest<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { token?: string | null; body?: unknown } = {},
): Promise<T> {
  const { body, token, headers, ...rest } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: { message?: string }; message?: string };
      message = payload.error?.message ?? payload.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return unwrap<T>(await response.json());
}

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL.replace(/\/v1\/?$/, "")}${path}`;
}

export { API_URL };
