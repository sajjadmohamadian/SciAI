import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  apiJson,
  apiRequest,
  ApiRequestError,
  AUTHENTICATED_DEPLOYMENT_REQUIRED_MESSAGE,
} from "../src/utils/apiClient.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("frontend API client", () => {
  test("maps 401 and 403 responses to authenticated deployment guidance", async () => {
    for (const status of [401, 403]) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: "Authentication required" }), {
          status,
          headers: { "content-type": "application/json" },
        })) as typeof fetch;

      await assert.rejects(
        apiRequest("/api/protected", { method: "POST" }),
        (err: unknown) => {
          assert(err instanceof ApiRequestError);
          assert.equal(err.message, AUTHENTICATED_DEPLOYMENT_REQUIRED_MESSAGE);
          assert.equal(err.status, status);
          assert(status === 401 ? err.code === "auth_required" : err.code === "forbidden");
          return true;
        }
      );
    }
  });

  test("does not attach Authorization or X-API-Key headers to JSON requests", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await apiJson("/api/analyses/run", { capability_id: "publication.year_distribution" });

    const headers = new Headers(capturedInit?.headers || undefined);
    assert.equal(headers.get("Authorization"), null);
    assert.equal(headers.get("X-API-Key"), null);
    assert.equal(headers.get("Content-Type"), "application/json");
  });

  test("preserves browser-managed FormData boundaries and does not add auth headers", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ datasets: [], total_records_ingested: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const formData = new FormData();
    formData.append("name", "sample");
    await apiRequest("/api/datasets/upload", { method: "POST", body: formData });

    const headers = new Headers(capturedInit?.headers || undefined);
    assert.equal(capturedInit?.body, formData);
    assert.equal(headers.get("Content-Type"), null);
    assert.equal(headers.get("Authorization"), null);
    assert.equal(headers.get("X-API-Key"), null);
  });

  test("classifies HTML and malformed JSON responses safely", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>gateway login</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;

    await assert.rejects(apiRequest("/api/datasets/upload"), (err: unknown) => {
      assert(err instanceof ApiRequestError);
      assert.equal(err.code, "html_response");
      return true;
    });

    globalThis.fetch = (async () =>
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    await assert.rejects(apiRequest("/api/datasets/upload"), (err: unknown) => {
      assert(err instanceof ApiRequestError);
      assert.equal(err.code, "malformed_json");
      return true;
    });
  });
});
