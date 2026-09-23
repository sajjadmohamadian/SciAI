# SciAI

SciAI is a React/TypeScript and Express application for transparent bibliometric, scientometric, and data-analysis workflows.

## Development

```bash
npm install
```

```bash
npm run dev
```

The development server serves both the React app and Express API from the same origin by default. Use `GET /api/health` to confirm the API process is reachable.

## Authentication and deployment

SciAI protects data-changing and AI/ML mutation routes with a server-side API token middleware. This includes dataset upload, sample cohort ingestion, dataset deletion, analysis execution, Smart Merge, OpenAlex import, and other protected POST/DELETE operations.

- `SCIAI_API_TOKEN` or `API_TOKEN` is a server-side secret for protected server-to-server/admin API calls.
- Never expose this value to browser JavaScript.
- Never put API tokens in `VITE_*` variables, localStorage, sessionStorage, URLs, rendered HTML, or a browser-readable config endpoint.
- `VITE_*` values are compiled into the client bundle and are visible to users.

For local loopback-only development, `SCIAI_DEV_AUTH_BYPASS="true"` allows protected mutations only when no API token is configured and the server host is loopback (`localhost`, `127.0.0.1`, or `::1`). Non-loopback deployments fail closed without a configured token.

For hosted browser use, choose one of these safe patterns:

1. **Trusted gateway injection**: authenticate users at a same-origin gateway/reverse proxy, strip client-supplied auth headers, and inject server-side credentials only on the trusted server-to-server hop.
2. **Real browser auth/session**: add a login provider, secure `HttpOnly` cookies, CSRF/Origin protections, and server-side session authorization.
3. **Read-only hosted UI with admin API mutations**: keep protected mutations unavailable in the browser when token auth is enabled and use server-to-server/admin tools for writes.

Do not add an anonymous token/session bootstrap endpoint. The browser cannot safely receive `SCIAI_API_TOKEN`.

## Upload API

- Health check: `GET /api/health`
- Dataset upload: `POST /api/datasets/upload`
- Sample cohort: `POST /api/datasets/load-sample-cohort`

Uploads use browser-generated multipart `FormData`; do not manually set the multipart `Content-Type` boundary. The server enforces bounded temporary-file upload limits: 25 MB per file, 50 MB per request, and up to 10 files.

Example server-to-server upload shape:

```bash
curl -H "Authorization: Bearer $SCIAI_API_TOKEN" -F "files=@sample.csv" -F "merge_on_upload=true" http://localhost:3000/api/datasets/upload
```

This example is for trusted server-side/admin use only. Do not copy this token into frontend code.

## Diagnosing 401/403 upload failures

If browser upload shows `Authentication required`:

1. Open the browser Network panel and inspect the failing request URL.
2. Confirm `GET /api/health` works from the same origin.
3. Confirm the request is going to the intended SciAI API, not a preview gateway or stale deployment.
4. If `SCIAI_API_TOKEN` is configured, browser mutations will return 401/403 unless a trusted gateway or real browser auth/session is deployed.
5. Do not fix this by exposing the server token to the browser.

## Verification

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```
