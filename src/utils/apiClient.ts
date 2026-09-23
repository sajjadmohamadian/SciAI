export const AUTHENTICATED_DEPLOYMENT_REQUIRED_MESSAGE =
  "This operation requires authenticated server deployment. The browser cannot use the server API token directly. Configure a trusted gateway or real user session on the server, then retry.";

export type ApiErrorCode =
  | "auth_required"
  | "forbidden"
  | "not_found"
  | "payload_too_large"
  | "server_error"
  | "html_response"
  | "malformed_json"
  | "network_error"
  | "http_error";

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(message: string, options: { status?: number; code: ApiErrorCode; details?: unknown }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

const extractServerMessage = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const message = record.error || record.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
};

const makeHttpError = (response: Response, data: unknown): ApiRequestError => {
  const serverMessage = extractServerMessage(data);

  if (response.status === 401) {
    return new ApiRequestError(AUTHENTICATED_DEPLOYMENT_REQUIRED_MESSAGE, {
      status: response.status,
      code: "auth_required",
      details: serverMessage,
    });
  }

  if (response.status === 403) {
    return new ApiRequestError(AUTHENTICATED_DEPLOYMENT_REQUIRED_MESSAGE, {
      status: response.status,
      code: "forbidden",
      details: serverMessage,
    });
  }

  if (response.status === 413) {
    return new ApiRequestError(
      serverMessage || "Upload exceeds the server size limit. Use smaller bibliometric export files and retry.",
      { status: response.status, code: "payload_too_large", details: data }
    );
  }

  if (response.status === 404) {
    return new ApiRequestError(serverMessage || "The requested SciAI API endpoint was not found.", {
      status: response.status,
      code: "not_found",
      details: data,
    });
  }

  if (response.status >= 500) {
    return new ApiRequestError(
      serverMessage || "SciAI server failed while processing the request. Please retry after checking server logs.",
      { status: response.status, code: "server_error", details: data }
    );
  }

  return new ApiRequestError(serverMessage || `SciAI API request failed with status ${response.status}.`, {
    status: response.status,
    code: "http_error",
    details: data,
  });
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return null;

  if (contentType.includes("text/html") || text.trimStart().startsWith("<")) {
    throw new ApiRequestError(
      "SciAI received a non-JSON HTML response. The app may be pointed at the wrong origin, a preview gateway, or a server that is still starting.",
      { status: response.status, code: "html_response", details: text.slice(0, 200) }
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) {
      return { error: text.slice(0, 300) || response.statusText };
    }
    throw new ApiRequestError("SciAI API returned malformed JSON.", {
      status: response.status,
      code: "malformed_json",
      details: text.slice(0, 300),
    });
  }
};

export async function apiRequest<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(input, init);
    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw makeHttpError(response, data);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError("Unable to reach the SciAI API. Check the server, deployment origin, and network/CORS configuration.", {
      code: "network_error",
      details: err instanceof Error ? err.message : err,
    });
  }
}

export function apiJson<T = unknown>(input: RequestInfo | URL, body: unknown, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || undefined);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return apiRequest<T>(input, {
    ...init,
    method: init.method || "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};
