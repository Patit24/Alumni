/**
 * Authenticated client-side fetch helper for Samparka.
 * Automatically attaches Authorization: Bearer <token> from localStorage (alumni_session_token)
 * to ensure seamless authentication across mobile Capacitor WebViews and web browsers.
 */

export function getClientSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem("alumni_session_token") ||
      sessionStorage.getItem("alumni_session_token") ||
      null
    );
  } catch {
    return null;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getClientSessionToken();
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has("Authorization") && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Include credentials for cookie-based sessions as well
  const credentials = init?.credentials || "include";

  return fetch(input, {
    ...init,
    headers,
    credentials,
  });
}
