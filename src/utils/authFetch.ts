export const SESSION_EXPIRED_EVENT = "sciai:session-expired";

type Session = { enabled: boolean; csrfToken: string | null };
let session: Session = { enabled: false, csrfToken: null };

// Session secrets live only in memory. Never use browser storage or URL parameters.
export function setFetchSession(csrfToken: string | null, enabled = true) {
  session = { enabled, csrfToken };
}

export function createAuthFetch(
  nativeFetch: typeof fetch,
  origin: string,
  getSession: () => Session,
  onSessionExpired: () => void,
): typeof fetch {
  return async (input, init) => {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), origin);
    const sameOrigin = url.origin === new URL(origin).origin;
    const startedSession = getSession();
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
    let options = init;
    const headers = new Headers(init?.headers ?? request?.headers);
    if (!sameOrigin && headers.has("X-CSRF-Token")) {
      headers.delete("X-CSRF-Token");
      options = { ...init, headers };
    } else if (sameOrigin && startedSession.enabled && mutating && startedSession.csrfToken) {
      headers.set("X-CSRF-Token", startedSession.csrfToken);
      options = { ...init, headers };
    }
    // Keep the original Request/body: rebuilding it can consume streams or break FormData boundaries.
    const response = await nativeFetch(input, options);
    const publicAuthRoute = /^\/api\/auth\/(login|reset)\/?$/.test(url.pathname);
    if (sameOrigin && startedSession.enabled && startedSession.csrfToken && response.status === 401 && !publicAuthRoute
      && getSession() === startedSession) {
      onSessionExpired();
    }
    return response;
  };
}

let installed = false;
export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.fetch = createAuthFetch(window.fetch.bind(window), window.location.origin, () => session, () => {
    setFetchSession(null);
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  });
}
