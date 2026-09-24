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
3. **Public upload mode**: if uploads must be open to everyone, set `SCIAI_PUBLIC_UPLOADS="true"` and configure `SCIAI_PUBLIC_ORIGIN` to the exact hosted site origin. This makes only `POST /api/datasets/upload` public; sample cohort loading, Smart Merge, dataset deletion, analysis execution, imports, and AI/ML mutations remain protected.
4. **Read-only hosted UI with admin API mutations**: keep protected mutations unavailable in the browser when token auth is enabled and use server-to-server/admin tools for writes.

Do not add an anonymous token/session bootstrap endpoint. The browser cannot safely receive `SCIAI_API_TOKEN`.

## AI provider configuration

SciAI supports a server-side AI provider router for Gemini, Claude, and OpenAI. Deterministic SciAI code remains authoritative for scientometric metrics; AI providers are used only for explanation, summarization, labeling, narrative drafting, and research suggestions grounded in supplied data. Unsupported values must be shown as `unavailable`, not invented.

Provider keys are server-only secrets:

- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Never expose provider keys through `VITE_*` variables, frontend code, browser storage, rendered HTML, query strings, or public capability endpoints. AI routes remain protected by `SCIAI_API_TOKEN`; public upload mode does not make AI routes public.

Routing is configured with:

```env
SCIAI_AI_DEFAULT_PROVIDER="gemini"
SCIAI_AI_PROVIDER_ORDER="gemini,claude,openai"
SCIAI_AI_ALLOW_FALLBACK="true"
SCIAI_GEMINI_MODEL="gemini-flash-latest"
SCIAI_CLAUDE_MODEL="claude-opus-5"
SCIAI_OPENAI_MODEL="gpt-4.1-mini"
```

Protected AI responses include `ai_provenance` with the provider/model used, attempted fallback path, timestamp, and limitations explaining that AI output is interpretive only.

## Upload API

- Health check: `GET /api/health`
- Dataset upload: `POST /api/datasets/upload`
- Sample cohort: `POST /api/datasets/load-sample-cohort`

Uploads use browser-generated multipart `FormData`; do not manually set the multipart `Content-Type` boundary. The server enforces bounded temporary-file upload limits: 25 MB per file, 50 MB per request, and up to 10 files.

When `SCIAI_PUBLIC_UPLOADS="true"`, unauthenticated browser uploads are accepted only for the upload endpoint and only from the configured public origin. Public uploads use the same file validation and upload-size limits plus a lightweight in-memory IP rate limit. Public uploads write into the shared SciAI dataset store, so do not use this mode for private per-user data until real user accounts and per-user authorization exist.

## Render deployment

This repository includes `render.yaml` for Render Blueprint deployment. It builds with `npm install && npm run build` and starts with `npm start`. Render should provide `PORT`; the blueprint sets `HOST=0.0.0.0`, `NODE_ENV=production`, `SCIAI_PUBLIC_UPLOADS=true`, and generates a private `SCIAI_API_TOKEN`.

After Render creates the service URL, set `SCIAI_PUBLIC_ORIGIN` to that exact origin, for example `https://your-service.onrender.com`, then redeploy. If Render provides `RENDER_EXTERNAL_URL`, SciAI can use it as a fallback public-upload origin.

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
